# Application — DDD & EIP Analysis

## 1. Current Responsibility

Manages worker applications to errands (providers applying for client jobs):

- Creating applications (`apply` method)
- Fetching application by ID (`getApplicationById`)
- Listing applications for an errand (`errandApplications` — client view)
- Application summary statistics (`errandApplicationSummary` — counts by status, chatting applicants)
- Fetching user's own application for an errand (`myApplicationForErrand`)
- **Acceptance logic** is in `EscrowService.acceptApplicationAndFundEscrow` (NOT in this module)

**Files**: `application.service.ts` (~200 lines), `application.resolver.ts`, `application.module.ts`.

## 2. Bounded Context Assessment

**This should be a sub-domain of Errands**, not a standalone bounded context.

- Application is a **relationship entity** between Errand and Provider — it represents a provider's intent to work on an errand.
- It has lifecycle states (`PENDING` → `ACCEPTED` | `REJECTED` | `CANCELLED`), but those states are tightly coupled to errand status transitions.

**Overlaps**:

- **Errands**: Applications are filtered by errand status (line 49: `errand.status !== ErrandStatus.OPEN` guard). Errand status drives application lifecycle.
- **Escrow**: Acceptance logic lives in `EscrowService` (line 13: `import { EscrowService }`), not in `ApplicationService`.
- **Provider**: Application references `workerId` (provider ID), but provider discovery/matching is separate.

**Verdict**: Application is a **supporting sub-domain** within the Errands bounded context. It should be folded into Errands domain layer as a child entity or aggregate.

## 3. Domain Model Audit

**Anemic models**:

- `Application` (Prisma model) is a data bag with `errandId`, `workerId`, `status`, `acceptedAt`. No behavior.
- No methods for state transitions (`accept()`, `reject()`, `cancel()`).

**Aggregate boundaries**:

- **Option 1: Application as child entity of Errand**:
  - `Errand` aggregate owns `Application` collection.
  - `Errand.applyWorker(workerId)` creates application.
  - `Errand.acceptApplication(applicationId)` transitions errand status + application status together.
  - Benefits: Ensures consistency (cannot accept application if errand is no longer `OPEN`).

- **Option 2: Application as separate aggregate**:
  - `Application` is its own aggregate root.
  - Invariants: Can only apply if errand is `OPEN`, cannot accept twice.
  - Downside: Need distributed transaction or saga to keep errand + application in sync.

**Recommendation**: Option 1 (child entity) because application lifecycle is inseparable from errand lifecycle.

**Invariants currently unenforced**:

1. **Cannot apply to closed errands**:
   - Checked in service (line 49: `if (errand.status !== ErrandStatus.OPEN)`), but not in domain layer.
   - What if errand status changes after fetch but before application creation? (Race condition.)
2. **Cannot apply twice**:
   - Unique constraint on `(errandId, workerId)` enforces this at DB level, but no domain validation.
   - If constraint fails, Prisma throws generic error instead of domain exception (`WorkerAlreadyApplied`).
3. **Cannot accept non-pending applications**:
   - Checked in `EscrowService` (line 100 in escrow.service.ts: `application.status !== ApplicationStatus.PENDING`), but NOT in `ApplicationService`.
4. **Source type guard**:
   - `apply` checks `errand.sourceType` (line 54: cannot apply to `LISTING_HIRE` or `RECURRING_CONTRACT`).
   - This is a business rule that should be an invariant in Errand domain, not scattered across services.

## 4. Layering Violations

**Business logic in wrong module**:

- **Acceptance logic is in Escrow module**, not Application module:
  - `EscrowService.acceptApplicationAndFundEscrow` (line 58 in escrow.service.ts) updates application status (line ~80-90).
  - Application module should own its own state transitions.

**Persistence leaking**:

- Direct Prisma calls: `this.prisma.application.*` throughout service.
- No repository abstraction.

**Cross-module dependencies**:

- `ApplicationService` depends on `EscrowService` (line 13: `import { EscrowService }`).
- But `ApplicationService` doesn't actually call escrow — the dependency is declared but unused (code smell: leftover from refactoring?).
- Resolver (`ApplicationResolver`) probably calls escrow directly (need to verify).

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IApplicationRepository (interface)
    - findById(id): Application | null
    - findByErrandAndWorker(errandId, workerId): Application | null
    - findAllForErrand(errandId): Application[]
    - save(application): void
infrastructure/
  PrismaApplicationRepository (implementation)
```

**Consolidation**: All `prisma.application.*` calls move to repository.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **ApplicationSubmitted event**:
   - When `apply` creates application (line 60), emit `ApplicationSubmitted` event.
   - Listeners:
     - Notification module sends push to client ("New application from Provider X").
     - Recommendation engine updates provider ranking.

2. **ApplicationAccepted event**:
   - Currently acceptance is handled in escrow module (wrong layer).
   - Should be: `Application.accept()` method emits `ApplicationAccepted` → Escrow listens → funds escrow.
   - Chain: `ApplicationAccepted` → `EscrowFunded` → `ErrandAssigned` → `ApplicationsCancelled` (other pending apps).

3. **Replace direct method calls with Saga**:
   - Current: Acceptance is a monolithic operation in `EscrowService.acceptApplicationAndFundEscrow` (110 lines).
   - Proposed: Saga orchestrates:
     ```
     AcceptApplicationCommand
       → ApplicationAccepted event
       → FundEscrow command
       → EscrowFunded event
       → AssignErrand command
       → ErrandAssigned event
       → CancelOtherApplications command
     ```
   - Each step is idempotent, with compensation (e.g., if escrow funding fails, revert application to `PENDING`).

**Aggregator**:

- `errandApplicationSummary` (line 118) aggregates application data (counts by status, chatting applicants).
- This is a read model / query — should be in CQRS query handler, not in domain service.

**Dead Letter / Retry**:

- `apply` has no retry if Prisma create fails (e.g., network blip).
- If worker applies but DB times out, client sees error and worker must retry manually.
- Recommendation: Idempotent command with unique reference (`applicationId` pre-generated), retried from queue.

## 7. Cross-Cutting Concerns

**Validation**:

- Source type guard (line 54: cannot apply to listing-hire errands) is in application service — should be in Errand domain.
- Provider profile check (line 39: `if (!provider)`) is in service — should be guard in domain method.

**Transactions**:

- `apply` does not use explicit transaction, but creates a single record (auto-commit).
- Should be wrapped in use-case-level transaction: create application + log audit event.

**Error handling**:

- Throws generic `Error` (line 43: `'User does not have a provider profile'`, line 49: `'This errand is not open'`).
- No domain exceptions (`ErrandNotOpen`, `WorkerNotEligible`).

## 8. GraphQL-Specific Notes

**GraphQL types**:

- `Application` entity is likely 1:1 with Prisma model (need to verify `entities/application.entity.ts`).

**N+1 risk**:

- `errandApplications` (line 106) fetches all applications for an errand — if client code iterates to get provider details, N+1 query.
- No DataLoader.

**Authorization**:

- `errandApplications` checks client ownership (line 123: `client.id !== errand.clientId`).
- `getApplicationById` checks if caller is client OR worker (line 85-96) — good authorization logic.
- `apply` does NOT check if errand belongs to caller's client — but this is safe (providers can apply to any open errand).

## 9. Target Structure

**Option A: Merge into Errands module** (recommended)

```
src/errands/
  domain/
    entities/
      Errand.ts                     # Aggregate root
      Application.ts                # Child entity of Errand
    value-objects/
      ApplicationStatus.ts
    repositories/
      IErrandRepository.ts          # Includes application methods: findApplicationsForErrand()

  application/
    commands/
      SubmitApplication/
        SubmitApplicationCommand.ts
        SubmitApplicationHandler.ts
      AcceptApplication/
        AcceptApplicationCommand.ts
        AcceptApplicationHandler.ts  # Coordinates Application + Escrow + Errand via saga
    queries/
      GetApplicationsForErrand/
        GetApplicationsForErrandQuery.ts
        GetApplicationsForErrandHandler.ts
```

**Option B: Keep separate module** (if strong reason to decouple)

```
src/application/
  domain/
    entities/
      Application.ts                # Aggregate root with accept(), reject(), cancel()
    repositories/
      IApplicationRepository.ts
    events/
      ApplicationSubmitted.ts
      ApplicationAccepted.ts
      ApplicationRejected.ts

  application/
    commands/
      SubmitApplication/
        SubmitApplicationCommand.ts
        SubmitApplicationHandler.ts
    queries/
      GetApplicationsForErrand/
        GetApplicationsForErrandQuery.ts
        GetApplicationsForErrandHandler.ts
    sagas/
      AcceptApplicationSaga.ts      # Coordinates Application + Escrow + Errand

  infrastructure/
    repositories/
      PrismaApplicationRepository.ts

  presentation/
    resolvers:
      ApplicationResolver.ts
    types/
      ApplicationType.ts
```

---

## 10. Schema Findings

**Context**: Analysis of `prisma/model/application.prisma`.

### Aggregate Boundary Violations

1. **EscrowService directly mutates Application.status**
   - **Evidence**: `src/escrow/escrow.service.ts` (line ~90) calls `prisma.application.update({ data: { status: 'ACCEPTED' } })` within Escrow module.
   - **Schema gap**: No protection preventing other modules from bypassing Application aggregate.
   - **Impact**: Application status can change without triggering domain logic (state transition validation, event emission).
   - **Fix priority**: PHASE 1 — Escrow emits `EscrowFunded` event → `ApplicationEventHandler.handleEscrowFunded()` calls `Application.accept()`.
   - **Migration notes**: Code-only refactoring (no schema change). Risk: MEDIUM (need to coordinate Application + Escrow event flow).

### Dangling Reference Risks

1. **Application.errandId → Errand** (CRITICAL)
   - **Schema**: `Application.errand` relation has `@@unique([errandId, workerId])` constraint but no `onDelete` cascade rule.
   - **Bug**: Deleting errand orphans all applications for that errand.
   - **Impact**: **CRITICAL** — application records remain in database forever, cannot link to errand, worker history incomplete.
   - **Current cleanup**: None (errand deletion not implemented yet).
   - **Fix**: Add `onDelete: Cascade` to `Application.errand` relation.
   - **Justification**: Application is a child of Errand aggregate (no value without parent errand).
   - **Schema change**:
     ```prisma
     model Application {
       errand Errand @relation(fields: [errandId], references: [id], onDelete: Cascade)
     }
     ```
   - **Migration**: `npx prisma db push` (additive).
   - **Rollback**: Safe (remove cascade rule).
   - **Priority**: **PHASE 1** (before errand deletion feature).

2. **Application.workerId → Provider**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting provider orphans all applications from that worker.
   - **Impact**: MEDIUM — errand's application history incomplete.
   - **Fix options**:
     - **Option A**: Add `onDelete: Restrict` (prevent provider deletion if applications exist) — RECOMMENDED.
     - **Option B**: Add `onDelete: SetNull` (preserve application record, mark worker as deleted) — requires workerId to be nullable.
   - **Recommendation**: Option A (prevent deletion, soft-delete provider instead).
   - **Priority**: PHASE 2 (provider deletion not implemented yet).

3. **Application.errandSnapshot (Json field)**
   - **Note**: This is a denormalized copy of errand data at time of application.
   - **No dangling reference risk** (JSON blob, not a foreign key).
   - **Impact**: If errand changes after application, snapshot remains stale (expected behavior).

### Missing Indexes

**Critical indexes MISSING** (HIGH priority):

1. **Application.errandId** (CRITICAL for performance)
   - **Current**: Only `@@unique([errandId, workerId])` composite constraint exists.
   - **Bug**: Composite unique constraint is NOT an efficient index for single-column query on `errandId`.
   - **Query pattern**: `ApplicationService.errandApplications` (line 106) queries `where: { errandId }`.
   - **Impact**: Full collection scan when fetching applications for an errand (common query in client dashboard).
   - **Fix**: Add explicit `@@index([errandId])`.
   - **Priority**: **PHASE 1** (CRITICAL performance issue).

2. **Application.workerId** (HIGH for provider dashboard)
   - **Query pattern**: Provider dashboard showing "My Applications" (future feature).
   - **Impact**: Full collection scan when fetching applications by worker.
   - **Fix**: Add `@@index([workerId])`.
   - **Priority**: PHASE 2.

3. **Application.status** (MEDIUM for filtering)
   - **Query pattern**: Filtering applications by status (`where: { status: 'PENDING' }`).
   - **Impact**: Full collection scan when filtering by status.
   - **Fix**: Add `@@index([status])`.
   - **Priority**: PHASE 2.

**Schema changes needed**:

```prisma
model Application {
  // ... existing fields ...

  @@unique([errandId, workerId])
  @@index([errandId])        // CRITICAL: Add this
  @@index([workerId])        // HIGH: Add this
  @@index([status])          // MEDIUM: Add this
  @@map("applications")
}
```

**Migration**: `npx prisma db push` (additive, no backfill).
**Rollback**: Safe (drop indexes).

### Embed vs. Reference Decisions

**Application.errandSnapshot (Json field)** — denormalization already implemented ✅:

- **Current**: Application stores snapshot of errand data at time of application (embedded as JSON).
- **Justification**: Preserve errand details even if errand is updated/deleted later (audit trail).
- **No schema change needed** — already correctly denormalized.

### Migration / Rollback Strategy

**Phase 1 changes for Application** (URGENT):

1. **Add cascade rule for Application.errandId** (dangling ref fix):
   - Add `onDelete: Cascade` to `Application.errand` relation.
   - Migration: `npx prisma db push`.
   - Rollback: Safe (remove cascade).
   - Risk: LOW.

2. **Add CRITICAL missing index** (Application.errandId):
   - Migration: `npx prisma db push`.
   - Rollback: Safe (drop index).
   - Risk: LOW.

3. **Refactor EscrowService aggregate violation** (code-only):
   - Escrow emits `EscrowFunded` → `ApplicationEventHandler.handleEscrowFunded()` calls `Application.accept()`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: MEDIUM (need to coordinate with Escrow module event flow).

**Phase 2 changes for Application**:

1. **Add cascade/restrict for Application.workerId** (dangling ref fix):
   - Recommendation: `onDelete: Restrict` (prevent provider deletion if applications exist).
   - Migration: `npx prisma db push`.
   - Rollback: Safe (remove cascade).
   - Risk: LOW.

2. **Add remaining indexes** (workerId, status):
   - Migration: `npx prisma db push`.
   - Rollback: Safe (drop indexes).
   - Risk: LOW.

3. **Extract Application aggregate** (code-only):
   - Create `Application.submit()`, `Application.accept()`, `Application.reject()` methods.
   - Emit events: `ApplicationSubmitted`, `ApplicationAccepted`, `ApplicationRejected`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: MEDIUM (coordinate with Escrow + Errand modules).

**Risk revised from MEDIUM to MEDIUM**: Schema changes are low-risk (additive indexes, cascade rules), but code refactoring requires coordinating 3 modules (Application, Escrow, Errand).

**Mitigation**: Fix missing indexes immediately (Phase 1), defer aggregate extraction to Phase 2 after Escrow refactored.

---

## 11. Migration Risk & Priority

**Risk**: **MEDIUM**

- Application is tightly coupled to Errands and Escrow.
- Acceptance logic is split across modules (Application, Escrow, Errands) — refactoring requires coordinating all three.

**Priority**: **PHASE 1 (parallel with Escrow)**
**Rationale**:

1. Application acceptance is part of the escrow funding saga — must refactor together.
2. Decoupling application state transitions from escrow unblocks event-driven architecture.
3. Relatively small module (~200 lines) — easier to refactor early before more features pile on.

**Migration steps**:

1. **Decide**: Merge into Errands module OR keep separate (recommend merge for simplicity).
2. **Extract Application aggregate** with `submit()`, `accept()`, `reject()`, `cancel()` methods.
3. **Create SubmitApplicationCommandHandler** (replaces current `apply` method).
4. **Extract AcceptApplicationSaga** from `EscrowService.acceptApplicationAndFundEscrow`.
5. **Emit domain events**: `ApplicationSubmitted`, `ApplicationAccepted`.
6. **Update Escrow module** to listen to `ApplicationAccepted` instead of being called directly.
7. **Remove ApplicationService dependency on EscrowService** (if still exists).
8. **Test acceptance flow end-to-end** (staging environment).
