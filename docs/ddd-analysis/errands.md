# Errands — DDD & EIP Analysis

## 1. Current Responsibility

The Errands module is a **God Module** managing the entire lifecycle of jobs/errands (gig economy tasks): creation, search/discovery (geo-based with `$geoNear`), templates, recurring contracts, bundles, listings, assignment tracking, and saved errands. It directly handles:

- CRUD for `Errand`, `ErrandTemplate`, `ErrandBundle`, `BundleItem`, `SavedErrand`, `RecurringContract`, `ErrandAssignment`
- Complex geospatial queries for personalized feeds (feed, best-match, most-recent, search)
- Status transitions (`DRAFT` → `OPEN` → `IN_PROGRESS` → `COMPLETED`)
- Location auto-update via event listener (`@OnEvent('errand.updated')`)
- Escrow integration (resolver calls `EscrowService.markErrandCompleted`)

**Files**: `errands.resolver.ts` (~300 lines), `errands.service.ts` (~1100+ lines), 17+ DTOs.

## 2. Bounded Context Assessment

**This is THE core bounded context** — the "Job Management" or "Errand Lifecycle" domain.
**Overlaps**:

- **Application**: Errand assignment logic leaks into Application module (applications depend on errand status), but Application should be a sub-domain of Errands.
- **Escrow**: Escrow state transitions are tightly coupled to errand status changes (errand completion triggers escrow release). Escrow is a supporting sub-domain that should listen to errand domain events.
- **Service**: Errands reference `serviceId` for categorization, but this is a value object reference, not a responsibility overlap.

**Verdict**: Real bounded context, but bleeding into Application and overly coupled to Escrow via direct service calls.

## 3. Domain Model Audit

**Anemic models**:

- `Errand` (Prisma model) is passed directly to GraphQL as a data bag. No domain behavior for:
  - Validating status transitions (`DRAFT` → `OPEN` requires price + location set)
  - Enforcing invariants (cannot assign if status ≠ `OPEN`, cannot complete if not assigned)
  - Calculating total cost (base price + transport + materials)
- `ErrandTemplate`, `RecurringContract`, `ErrandBundle` are pure data structures with no behavior.

**Aggregate boundaries**:

- **`Errand`** should be the aggregate root, owning:
  - `SavedErrand` (child entity)
  - `ErrandAssignment` (child entity — worker assignment history)
  - Location (value object, not a raw JSON field)
  - Pricing (value object encapsulating `price`, `hourlyRate`, `transportAllowance`, `materialsBudget`)
- **`ErrandTemplate`** is a separate aggregate (templates exist independently of errands).
- **`RecurringContract`** is a separate aggregate (schedule + pre-acceptance state).

**Invariants currently unenforced**:

1. **Status transitions**:
   - `ErrandsService.update` allows arbitrary status changes (line 173-210) without validation.
   - `EscrowService.markErrandCompleted` enforces status in escrow module (!), not in domain layer.
2. **Assignment rules**:
   - Application acceptance changes `assignedTo` and `status` in Application module (layering violation).
   - No guard preventing multiple assignments (escrow unique constraint is a DB-level check, not domain logic).
3. **Pricing completeness**:
   - No validation that `OPEN` errands have pricing set before posting.
4. **Geo-location consistency**:
   - `serviceAddress` and `location` can drift out of sync. Event listener `handleErrandUpdated` (line 250) tries to fix this reactively, but this is a band-aid for missing invariant.

## 4. Layering Violations

**Resolvers calling Prisma**:

- None directly in `ErrandsResolver`, but resolver calls `EscrowService.markErrandCompleted` (line 112), which is a cross-module business operation disguised as a resolver method. The resolver should call an ErrandApplicationService "CompleteErrand" use case.

**Business logic in service**:

- `ErrandsService` is 1100+ lines of business logic:
  - Geospatial feed algorithms (`getFeedErrands`, `getBestMatchErrands`, line 315+) — this is application logic, but mixed with data access.
  - Priority scoring for matching (line 124: `priorityMatch`, `addFields.priority`) — domain logic for ranking.
  - Location auto-update listener (line 250: `handleErrandUpdated`) — infrastructure concern (event handling) with domain logic (address matching).

**Persistence leaking into domain**:

- `ErrandsService` directly uses Prisma client for everything.
- Methods like `aggregateRaw` (line 93) use MongoDB-specific `$geoNear` aggregation — domain logic is now coupled to MongoDB implementation.
- `GeoPoint` interface (line 24) is a raw MongoDB GeoJSON structure, not a domain value object.

## 5. Repository Pattern Gap

**Current state**: No repository abstraction. `ErrandsService` is both application service AND data access layer.

**Proposed**:

```
domain/
  ErrandRepository (interface)
    - findById(id): Errand
    - findOpenNearLocation(location, maxDistance, filters): Errand[]
    - save(errand): void
    - findByStatus(status): Errand[]
infrastructure/
  PrismaErrandRepository (implementation)
    - Encapsulates all Prisma calls + MongoDB aggregations
    - Maps Prisma types → domain entities
```

**Consolidation**: All Prisma calls in `ErrandsService` (50+ scattered `this.prisma.errand.*` calls) move into `PrismaErrandRepository`.

## 6. EIP Opportunities

**Message Router / Content-Based Router**:

- `getErrands` switch statement (line 297) routes by `ErrandType` enum. This is a manual router that should be:
  - A strategy pattern in the application layer, OR
  - A proper message channel where `ErrandQueryInput` is dispatched to feed-specific query handlers.

**Command/Event patterns**:

1. **ErrandCreated event**: When `create` completes (line 65), emit `ErrandCreated` domain event → listeners:
   - Notification module sends push to nearby providers.
   - Recommendation engine indexes the errand.
2. **ErrandStatusChanged event**: Currently `update` emits `errand.updated` (line 204), but only for location updates (!). Should emit on ALL status changes → listeners:
   - Escrow module reacts to `COMPLETED` status to release funds (instead of resolver calling escrow directly).
   - Application module cancels pending applications when errand moves to `IN_PROGRESS`.
3. **ErrandAssigned event**: Currently handled inline in `EscrowService.acceptApplicationAndFundEscrow`. Should be:
   - `Errand.assignWorker()` method emits event.
   - Escrow module listens and creates escrow.
   - Notification sends assignment confirmation.

**Dead Letter Channel / Retry**:

- `handleErrandUpdated` listener (line 250) silently logs on success but has no retry if Prisma `updateLocation` fails (e.g., DB timeout).
- No dead-letter queue for failed geolocation updates.
- Recommendation: Wrap event handlers in try-catch, push failed events to Redis queue with exponential backoff.

**Aggregator**:

- `getErrands` methods (`getFeedErrands`, `getBestMatchErrands`, line 315+) aggregate data from:
  - User profile (active address, provider type, skills)
  - Errand collection (geospatial + filters)
  - Priority scoring logic

  This is a legitimate aggregator pattern, but should be in a **Query Handler** (CQRS read model), not mixed with service.

## 7. Cross-Cutting Concerns

**Validation**:

- DTOs use `class-validator` (`CreateErrandInput`, etc.), but domain invariants are NOT validated (e.g., no check that `status === OPEN` errands have complete pricing).
- Geo-location validation is missing (can create errand with invalid `location` JSON).

**Transactions**:

- No explicit transactions in `ErrandsService`. Each Prisma call auto-commits.
- `update` (line 173) and `create` (line 50) should be wrapped in use-case-level transactions (create errand + log audit event).

**Error handling**:

- Throws generic `Error` strings (line 41: `'Client not found'`, line 84: `'No active address set'`).
- No domain exceptions (e.g., `ErrandNotOpenForApplications`, `InvalidErrandStatus`).
- `aggregateRaw` has a try-catch for geospatial index errors (line 138), but falls back to a query with different semantics (no distance filtering) — this is hiding a deployment issue, not handling an error.

## 8. GraphQL-Specific Notes

**1:1 Prisma mapping**:

- `Errand` entity is Prisma model + GraphQL type with minimal transformation.
- `PaginatedErrands` (line 24 import) wraps raw Prisma results, not domain objects.

**N+1 risk**:

- `findAll` (line 73) includes `{ ratings: true, client: { user: true, paymentMethods: true } }` — safe for single query.
- `getErrands` → `getFeedErrands` (line 327+) uses aggregation, so no N+1.
- However, if client code iterates `errands.map(e => e.client)`, no DataLoader is in place. **No DataLoader usage found in codebase**.

**Authorization**:

- Resolver-level: `@UseGuards(GqlAuthGuard)` on all mutations/queries.
- Domain-level: Missing. Anyone can call `updateErrand` — no check that current user owns the errand or is the assigned worker.
- Example: `removeErrand` (line 276) deletes ANY errand by ID without owner check (critical security flaw).

## 9. Target Structure

```
src/errands/
  domain/
    entities/
      Errand.ts                    # Rich aggregate root with status transition methods
      ErrandTemplate.ts            # Template aggregate
      RecurringContract.ts         # Recurring contract aggregate
      ErrandAssignment.ts          # Value object / child entity
    value-objects/
      Location.ts                  # Wraps GeoJSON, validates coordinates
      Pricing.ts                   # Encapsulates price/hourly/transport/materials
      ErrandStatus.ts              # Enum + transition rules
    repositories/
      IErrandRepository.ts         # Interface: findById, save, findNearby, etc.
      IErrandTemplateRepository.ts
    services/
      ErrandDomainService.ts       # Domain service for cross-aggregate logic (e.g., match errands to providers)
    events/
      ErrandCreated.ts
      ErrandStatusChanged.ts
      ErrandAssigned.ts

  application/
    commands/
      CreateErrand/
        CreateErrandCommand.ts
        CreateErrandHandler.ts     # Use case: validate, create Errand entity, save via repo, emit event
      AssignErrandToWorker/
        AssignErrandCommand.ts
        AssignErrandHandler.ts
      CompleteErrand/
        CompleteErrandCommand.ts
        CompleteErrandHandler.ts
    queries/
      GetPersonalizedFeed/
        GetPersonalizedFeedQuery.ts
        GetPersonalizedFeedHandler.ts  # Read model: geospatial + priority scoring
      GetErrandById/
        GetErrandByIdQuery.ts
        GetErrandByIdHandler.ts
    event-handlers/
      OnErrandUpdatedLocationSync.ts  # Listens to ErrandUpdated, syncs location from UserAddress

  infrastructure/
    repositories/
      PrismaErrandRepository.ts     # Implements IErrandRepository, encapsulates Prisma + MongoDB aggregations
    persistence/
      ErrandMapper.ts               # Maps Prisma types ↔ domain entities

  presentation/
    resolvers/
      ErrandResolver.ts             # Thin resolver: calls command/query handlers
    dto/
      CreateErrandInput.ts          # GraphQL input, maps to CreateErrandCommand
    types/
      ErrandType.ts                 # GraphQL type, mapped from domain Errand
```

---

## 10. Schema Findings

**Context**: Analysis of `prisma/model/errand.prisma` and cross-module references.

### Aggregate Boundary Violations

1. **EscrowService directly mutates Errand.status**
   - **Evidence**: `src/errands/errands.service.ts` (lines 198, 1799, 1941) calls `prisma.errand.update({ data: { status: 'COMPLETED' } })` from within Escrow module.
   - **Schema gap**: No protection preventing other modules from bypassing Errand aggregate.
   - **Impact**: Errand status can change without triggering Errand domain logic (state transition validation, event emission).
   - **Fix priority**: PHASE 1 — Escrow emits `EscrowReleased` event → `ErrandEventHandler.handleEscrowReleased()` calls `Errand.complete()`.
   - **Migration notes**: Code-only refactoring (no schema change). Risk: MEDIUM (need to coordinate Errand + Escrow event flow).

### Dangling Reference Risks

1. **Application.errandId → Errand**
   - **Schema**: `Application.errandId` has no cascade rule.
   - **Bug**: Deleting errand orphans all applications for that errand.
   - **Impact**: MEDIUM — provider's application history incomplete.
   - **Current cleanup**: None (errand deletion not implemented yet).
   - **Fix**: Add `onDelete: Cascade` to `Application.errand` relation (deleting errand cascades to applications).
   - **Migration**: `npx prisma db push` (additive).
   - **Rollback**: Safe (remove cascade rule).
   - **Priority**: PHASE 1 (before errand deletion feature).

2. **SavedErrand.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all saved errand bookmarks.
   - **Impact**: LOW — UI shows broken links in user's saved list.
   - **Fix**: Add `onDelete: Cascade`.
   - **Priority**: PHASE 1.

3. **Rating.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all ratings for that errand.
   - **Impact**: MEDIUM — cannot link rating to originating job.
   - **Fix**: Add `onDelete: SetNull` (preserve rating for provider/client profile, but clear errand link).
   - **Priority**: PHASE 2.

4. **Transaction.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans wallet transactions.
   - **Impact**: **CRITICAL** — financial audit trail broken.
   - **Fix**: Add `onDelete: Restrict` (prevent errand deletion if transactions exist) OR coordinate with Wallet module.
   - **Priority**: PHASE 1 (documented in Wallet module findings).

5. **Escrow.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans escrow record.
   - **Impact**: **HIGH** — financial audit trail broken.
   - **Fix**: Add `onDelete: Restrict`.
   - **Priority**: PHASE 1 (documented in Escrow module findings).

6. **Errand.assignedTo → Provider** (field-level dangling reference)
   - **Schema**: `Errand.assignedTo` is a nullable String field (not a formal Prisma relation), so no cascade rule possible.
   - **Bug**: Deleting provider leaves `assignedTo` as dangling ID.
   - **Impact**: MEDIUM — cannot resolve assigned provider in GraphQL queries.
   - **Current cleanup**: None.
   - **Fix**: Add event handler: `ProviderDeleted` → nullify all `Errand.assignedTo` matching deleted provider ID.
   - **Migration**: Code deployment (event handler).
   - **Rollback**: Code revert.
   - **Priority**: PHASE 2.

7. **Errand.serviceId → Service**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting service category orphans errands.
   - **Impact**: LOW (services are reference data, deletion unlikely).
   - **Fix**: Add `onDelete: SetNull` OR restrict service deletion if errands exist.
   - **Priority**: PHASE 3 (defer until service management implemented).

### Missing Indexes

**Critical index confirmed present**:

- ✅ **Errand.location (2dsphere geospatial index)**: Verified via `prisma/create-geo-index.ts` script.
  - **Query pattern**: `ErrandsService.getFeedErrands` uses `$geoNear` aggregation.
  - **Migration**: Already handled by existing script (must verify it's run on production).

**Missing indexes found**:

1. **Errand.clientId** (CRITICAL for client dashboard)
   - **Query pattern**: `ErrandsService.findAll` queries `where: { clientId }`.
   - **Impact**: Full collection scan when fetching client's errands.
   - **Fix**: Add `@@index([clientId])`.
   - **Priority**: PHASE 2.

2. **Errand.status** (HIGH for filtering open errands)
   - **Query pattern**: `ErrandsService.getFeedErrands` queries `where: { status: ErrandStatus.OPEN }`.
   - **Impact**: Full collection scan when filtering by status.
   - **Fix**: Add `@@index([status])`.
   - **Priority**: PHASE 2.

3. **Errand.assignedTo** (MEDIUM for provider's assigned errands)
   - **Query pattern**: Future feature (provider dashboard showing assigned errands).
   - **Impact**: Full collection scan.
   - **Fix**: Add `@@index([assignedTo])`.
   - **Priority**: PHASE 2.

4. **Errand.serviceId** (MEDIUM for service-based filtering)
   - **Query pattern**: Filtering errands by service category.
   - **Impact**: Full collection scan.
   - **Fix**: Add `@@index([serviceId])`.
   - **Priority**: PHASE 2.

5. **ErrandAssignment.errandId** ✅ (already has `@@index([errandId])` — confirmed).

**Schema changes needed**:

```prisma
model Errand {
  // ... existing fields ...

  @@index([clientId])
  @@index([status])
  @@index([assignedTo])
  @@index([serviceId])
  @@map("errands")
}
```

**Migration**: `npx prisma db push` (additive, no backfill).
**Rollback**: Safe (drop indexes).

### Embed vs. Reference Decisions

**Not applicable for Errand core fields** — all fields remain normalized (no denormalization proposed).

**Note on Location value object**:

- **Current**: `Errand.location` is `Json?` field (GeoJSON `{ type: "Point", coordinates: [lng, lat] }`).
- **Proposal**: Extract `Location` value object in domain layer (code-level abstraction, NOT schema change).
- **Justification**: Keep as JSON in schema for queryability (MongoDB geospatial queries require GeoJSON format).
- **Domain layer**: `Location` value object wraps JSON, provides `distanceTo()` method using haversine.

**Note on Pricing value object**:

- **Current**: `Errand.price`, `Errand.hourlyRate`, `Errand.transportAllowance`, `Errand.materialsBudget` are separate columns.
- **Proposal**: Extract `Pricing` value object in domain layer (code-level abstraction, NOT schema change).
- **Justification**: Keep as separate columns for queryability (filter errands by `price < 5000`).

### Migration / Rollback Strategy

**Phase 2 changes for Errands** (deferred until after Escrow/Application refactored):

1. **Add cascade rules** (5 dangling-reference fixes):
   - `Application.errandId` → `onDelete: Cascade`
   - `SavedErrand.errandId` → `onDelete: Cascade`
   - `Rating.errandId` → `onDelete: SetNull`
   - `Escrow.errandId` → `onDelete: Restrict`
   - Transaction handled in Wallet module
   - Migration: `npx prisma db push`
   - Rollback: Safe (remove constraints)
   - Risk: LOW

2. **Add indexes** (4 missing indexes):
   - Migration: `npx prisma db push`
   - Rollback: Safe (drop indexes)
   - Risk: LOW

3. **Add event handler for Provider deletion** (Errand.assignedTo):
   - Migration: Code deployment
   - Rollback: Code revert
   - Risk: LOW

4. **Extract Errand aggregate + events** (code-only):
   - Create `Errand.assignWorker()`, `Errand.complete()`, `Errand.cancel()` methods.
   - Emit events: `ErrandCreated`, `ErrandAssigned`, `ErrandCompleted`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: **MEDIUM-HIGH** (core domain, large codebase, 14 resolvers depend on ErrandsService).

5. **No backfill scripts needed** (all schema changes are additive).

**Risk revised from HIGH to MEDIUM-HIGH**: Schema analysis shows most changes are low-risk (indexes, cascade rules). Main risk is code refactoring due to large surface area (14 resolvers, 1100+ line service).

**Mitigation**: Incremental refactoring (introduce repository pattern PARALLEL to existing service, migrate resolvers one-by-one, remove old service last).

---

## 11. Migration Risk & Priority

**Risk**: **HIGH**

- Errands is the most critical module (core business domain).
- 14 resolvers depend on `ErrandsService` methods.
- `EscrowService`, `ApplicationService`, `ProviderService` all reference Errand entities.
- Geospatial queries are MongoDB-specific (`$geoNear`) — refactoring requires careful testing to avoid breaking location-based feeds.

**Priority**: **PHASE 2 (after Escrow + Application)**
**Rationale**:

1. Start with **Escrow** (Phase 1) to decouple escrow state from errand operations via domain events.
2. Refactor **Application** (Phase 1) to handle assignment logic, emitting `ErrandAssigned` event.
3. THEN refactor Errands to listen to events instead of direct calls, and enforce status transitions in the domain layer.

**Migration steps**:

1. Extract `Location` and `Pricing` value objects (low risk, immediate benefit).
2. Introduce `IErrandRepository` interface, implement `PrismaErrandRepository` (parallel to existing service).
3. Create `CreateErrandHandler`, `UpdateErrandHandler` command handlers (call repo instead of Prisma).
4. Replace resolver calls to service with calls to command/query handlers.
5. Emit domain events (`ErrandCreated`, `ErrandStatusChanged`) and migrate listeners.
6. Remove direct Prisma calls from service, enforce invariants in Errand entity.
