# Escrow — DDD & EIP Analysis

## 1. Current Responsibility

Manages payment escrow for errand completion: funds are held when a client accepts a worker's application, then released when the errand is marked complete. Handles:

- Escrow creation with Paystack payment charge (`acceptApplicationAndFundEscrow`)
- Platform fee calculation (basis points from env var)
- Amount splits (gross, platform fee, net worker amount)
- Idempotency via unique constraints (`errandId` unique on escrow table)
- Ledger transaction creation (`ESCROW_HOLD` transaction type)
- Errand status updates (`OPEN` → `IN_PROGRESS` when escrow funded)
- Application status updates (`PENDING` → `ACCEPTED`)
- Errand completion (`markErrandCompleted` updates status to `COMPLETED`, releases escrow)

**Files**: `escrow.service.ts` (~200+ lines), `escrow.module.ts`. **No resolver** — escrow operations are called directly by `ErrandsResolver` and `ApplicationResolver`.

## 2. Bounded Context Assessment

**This is a supporting sub-domain of Errands**, not a standalone bounded context.
**Overlaps**:

- **Errands**: `markErrandCompleted` (line 172+) updates errand status directly via Prisma — escrow should NOT own errand state transitions.
- **Application**: `acceptApplicationAndFundEscrow` (line 58+) updates application status and cancels other pending applications — escrow should NOT orchestrate application lifecycle.
- **Wallet**: Escrow manages wallet balance updates for client (hold) and worker (credit), but Wallet has no real implementation (stub service). This logic leaks into Escrow.
- **Payment-Gateway**: Tightly coupled to `PaymentGatewayService` for charging client card.

**Verdict**: Escrow is a **process manager** disguised as a domain service. It orchestrates cross-aggregate operations (errand + application + payment + wallet) instead of reacting to domain events.

## 3. Domain Model Audit

**Anemic models**:

- `Escrow` (Prisma model) is a data bag with fields: `amountGross`, `platformFee`, `amountNetWorker`, `status`, `holdUntil`, `releasedAt`. No behavior.
- `EscrowStatus` enum exists but has no state machine logic.

**Aggregate boundaries**:

- **`Escrow`** should be an aggregate root with:
  - `fund()` method (validates amount, sets status to `FUNDED`)
  - `hold()` method (transitions to `HELD` status, sets `holdUntil`)
  - `release()` method (validates errand completion, transitions to `RELEASING` → `RELEASED`, credits worker wallet)
  - `refund()` method (reverses payment to client)
  - `dispute()` method (freezes escrow, transitions to `DISPUTED`)
- **Escrow is NOT responsible for**:
  - Updating errand status (that's the Errand aggregate's job)
  - Updating application status (that's the Application aggregate's job)
  - Charging payment cards (that's an infrastructure concern via Payment-Gateway)

**Invariants currently unenforced**:

1. **Status transitions**:
   - `markErrandCompleted` (line 172) directly sets escrow status to `RELEASED` without checking current status (could be `DISPUTED` or already `RELEASED`).
   - No guard preventing double-release.
2. **Amount calculations**:
   - `calculateAmountGrossKobo` (line 26) pulls fields from Errand entity (price, hourlyRate, transport, materials) — escrow should receive a **Money value object** from Errand, not calculate it.
   - `calculatePlatformFeeKobo` (line 39) reads env var `ESCROW_PLATFORM_FEE_BPS` — this is a policy that should be injected as a domain service, not hardcoded infrastructure.
3. **Idempotency handling**:
   - `acceptApplicationAndFundEscrow` checks `existingEscrow` (line 78) and attempts "best-effort healing" (updates application + errand even if escrow already exists) — this is a workaround for lack of proper saga/process manager.
   - Healing logic (line 80-124) duplicates errand/application state updates — if the first accept attempt partially failed, retry could leave inconsistent state.

## 4. Layering Violations

**Business logic in service**:

- `acceptApplicationAndFundEscrow` (line 58-168) is a 110-line god method orchestrating:
  1. Fetch application + errand + client + payment method (data access)
  2. Validate business rules (errand status, application status, payment method verified)
  3. Calculate amounts (domain logic)
  4. Charge payment gateway (infrastructure)
  5. Create escrow (domain operation)
  6. Update errand + application status (cross-aggregate changes)
  7. Create ledger transaction (wallet operation)

  This is an **application service use case**, not a domain service. It belongs in `application/commands/AcceptApplicationAndFundEscrow/`.

**Persistence leaking into domain**:

- Direct Prisma calls throughout (`this.prisma.escrow.*`, `this.prisma.application.*`, `this.prisma.errand.*`).
- No repository abstraction.

**Cross-module state mutations**:

- `markErrandCompleted` (line 172) updates `errand.status` directly (line 198: `update({ where: { id: errandId }, data: { status: 'COMPLETED' } })`).
  - **This is a severe layering violation**: Escrow module should emit `EscrowReleased` event → Errand module listens and updates its own status.

## 5. Repository Pattern Gap

**Current state**: No repository. `EscrowService` is tightly coupled to Prisma.

**Proposed**:

```
domain/
  IEscrowRepository (interface)
    - findByErrandId(errandId): Escrow | null
    - save(escrow): void
infrastructure/
  PrismaEscrowRepository (implementation)
```

**Consolidation**: All `this.prisma.escrow.*` calls move into repository. Payment charging logic moves to `PaymentGatewayAdapter` in infrastructure.

## 6. EIP Opportunities

**Command/Event patterns** (critical for decoupling):

1. **Replace direct method calls with events**:
   - Current: `ErrandsResolver.markErrandCompleted` → `EscrowService.markErrandCompleted` (direct call).
   - Proposed: `ErrandsResolver` → `CompleteErrandCommandHandler` → emits `ErrandCompleted` event → `EscrowEventHandler` listens and releases escrow.

2. **Accept application as a Saga**:
   - Current: `acceptApplicationAndFundEscrow` orchestrates 7 steps inline (lines 58-168).
   - Proposed: Use NestJS CQRS Saga or event-driven process manager:
     ```
     ApplicationAcceptedEvent (emitted by Application module)
       → FundEscrowSaga listens
         → Charge payment (PaymentChargedEvent)
         → Create escrow (EscrowCreatedEvent)
         → Update errand status (via ErrandAssignedEvent)
         → Create wallet transaction (WalletDebitedEvent)
     ```
   - Each step is idempotent with compensation logic (e.g., if escrow creation fails after payment, auto-refund).

3. **Retry / Dead Letter**:
   - Payment gateway calls (line 148: `paymentGatewayService.chargeAuthorization`) can fail (network timeout, gateway down).
   - No retry logic — failure throws exception, client sees error.
   - Recommendation: Queue `ChargePendingEscrow` command to BullMQ, retry 3x with exponential backoff, send to dead-letter queue if all fail.

**Message Router**:

- `markErrandCompleted` conditionally updates escrow status based on current status (line 186: checks if `FUNDED` | `HELD`). This is a state machine that should be:
  - Encoded in `Escrow` aggregate (`release()` method guards against invalid transitions).
  - Routed via event: `ErrandCompleted` event → `ReleaseEscrowHandler` (only handles if escrow status allows release).

## 7. Cross-Cutting Concerns

**Validation**:

- Amount validation is scattered: `amountGrossKobo <= 0` checked in service (line 137), but no validation that `platformFee` doesn't exceed `amountGross`.
- Payment method validation (line 109: `!paymentMethod.verified`) is business logic in application service — should be in Payment-Gateway domain.

**Transactions**:

- `acceptApplicationAndFundEscrow` uses `prisma.$transaction` (line 80 in healing logic, implicit elsewhere).
- Transaction wraps multiple aggregate updates (application + errand + escrow + wallet transaction) — this is a distributed transaction smell.
- Better: Use eventual consistency via events (each aggregate updates in its own transaction, saga coordinates).

**Error handling**:

- Throws `BadRequestException` for domain errors (line 64: `'Application not found'`, line 145: `'Payment failed'`).
- No distinction between domain errors (`InvalidEscrowState`) and infrastructure errors (`PaymentGatewayTimeout`).
- No compensation: if payment succeeds but escrow creation fails, money is charged but no escrow record exists (line 148-168 wraps escrow creation, but payment is already done at line 154).

## 8. GraphQL-Specific Notes

**No GraphQL resolver**: Escrow operations are exposed indirectly via:

- `ErrandsResolver.markErrandCompleted` (calls `EscrowService.markErrandCompleted`)
- `ApplicationResolver.acceptApplication` (calls `EscrowService.acceptApplicationAndFundEscrow`)

**This is good** — escrow is an internal implementation detail, not a public API boundary. However:

- Lack of dedicated use case handlers means business logic leaks into resolvers (resolver knows to call escrow service).
- Should be: Resolver → `AcceptApplicationCommandHandler` (application layer) → handler coordinates Escrow + Application + Payment.

**Authorization**:

- `acceptApplicationAndFundEscrow` validates that current user is the client who owns the errand (line 90: `client.id !== errand.clientId`).
- `markErrandCompleted` does NOT validate authorization (assumes caller already checked) — risky if exposed via new resolver.

## 9. Target Structure

```
src/escrow/
  domain/
    entities/
      Escrow.ts                     # Aggregate root with fund(), hold(), release(), refund(), dispute()
    value-objects/
      Money.ts                      # Encapsulates amount + currency
      EscrowStatus.ts               # Enum + state transition guards
    repositories/
      IEscrowRepository.ts          # Interface: findByErrandId, save
    services/
      PlatformFeePolicy.ts          # Domain service for calculating platform fee (inject basis points)
    events/
      EscrowCreated.ts
      EscrowFunded.ts
      EscrowReleased.ts
      EscrowRefunded.ts
      EscrowDisputed.ts

  application/
    commands/
      FundEscrow/
        FundEscrowCommand.ts
        FundEscrowHandler.ts        # Use case: charge payment → create escrow → emit event
      ReleaseEscrow/
        ReleaseEscrowCommand.ts
        ReleaseEscrowHandler.ts     # Use case: validate errand complete → release funds → credit wallet
    sagas/
      FundEscrowSaga.ts             # Listens to ApplicationAccepted → coordinates payment + escrow creation
    event-handlers/
      OnErrandCompletedReleaseEscrow.ts  # Listens to ErrandCompleted → triggers ReleaseEscrowCommand

  infrastructure/
    repositories/
      PrismaEscrowRepository.ts     # Implements IEscrowRepository
    adapters/
      PaymentGatewayAdapter.ts      # Wraps PaymentGatewayService, exposes domain-friendly interface

  presentation/
    # No resolver needed (internal domain)
```

## 10. Migration Risk & Priority

**Risk**: **MEDIUM-HIGH**

- Escrow orchestrates critical payment flows (money movement).
- Refactoring escrow without breaking payment acceptance is risky.
- However, escrow is called by only 2 places (`ErrandsResolver.markErrandCompleted`, `ApplicationResolver.acceptApplication`), so impact surface is smaller than Errands.

**Priority**: **PHASE 1 (first, before Errands)**
**Rationale**:

1. Escrow's tight coupling to Errands is the ROOT CAUSE of many layering violations.
2. Decoupling escrow via domain events unblocks refactoring Errands and Application modules.
3. Escrow is a self-contained domain with clear aggregate boundaries — easier to refactor than the sprawling Errands module.

**Migration steps**:

1. **Extract Money value object** for amounts (amountGross, platformFee, amountNetWorker) — replace raw integers with `Money.fromKobo(amount, 'NGN')`.
2. **Create Escrow aggregate** with `fund()`, `release()` methods enforcing status transitions.
3. **Introduce IEscrowRepository** and `PrismaEscrowRepository`.
4. **Extract FundEscrowCommandHandler** from `acceptApplicationAndFundEscrow` (line 58-168).
5. **Emit domain events**:
   - `EscrowFunded` (after escrow created)
   - `EscrowReleased` (after release)
6. **Create event listener in Errands module** to react to `EscrowReleased` (update errand status to `COMPLETED`).
7. **Remove direct escrow calls from ErrandsResolver** — replace with `CompleteErrandCommandHandler` that emits `ErrandCompleted` event.
8. **Test payment flows end-to-end** before deploying (staging environment with Paystack test keys).
