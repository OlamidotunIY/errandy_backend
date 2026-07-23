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

---

## Persistence Model (Derived from Domain)

```prisma
model Escrow {
  id String @id @map("_id")
  errandId String
  clientId String
  workerId String
  amountGrossKobo Int
  platformFeeKobo Int
  amountNetWorkerKobo Int
  currency String
  status EscrowStatus
  holdUntil DateTime?
  releasedAt DateTime?
  refundedAt DateTime?
  createdAt DateTime
  updatedAt DateTime

  @@unique([errandId]) // backs: EscrowAlreadyExistsError
  @@index([clientId, status, createdAt]) // serves: findByClientId
  @@index([workerId, status, createdAt]) // serves: findByWorkerId
  @@index([status, holdUntil]) // serves: findExpiredHolds
}
```

Reference fields are scalar IDs only: `errandId`, `clientId`, `workerId`. Cleanup owners: `ErrandDeletedPolicyHandler` prevents deletion while escrow exists; `ClientDeletedPolicyHandler` and `ProviderDeletedPolicyHandler` require soft-delete/anonymization because escrow is a financial record. Indexes map directly to repository methods; `id` serves `findById`, and unique `errandId` serves `findByErrandId` while enforcing one escrow per errand.

---

## 11. Migration Risk & Priority

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

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Escrow aggregate root representing funds held in escrow for an errand.
 * Invariants:
 * - amountGross = platformFee + amountNetWorker (always enforced at construction)
 * - status transitions: PENDING → FUNDED → HELD → (RELEASING → RELEASED | REFUNDING → REFUNDED | DISPUTED)
 * - Cannot release/refund unless status is HELD
 * - Cannot transition backward in status flow
 * - One escrow per errand (errandId is unique)
 */
class EscrowId extends EntityId {
  /**
   * Private constructor. Use EscrowId.new() or EscrowId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new EscrowId.
   */
  static new(): EscrowId;

  /**
   * Rehydrates EscrowId from persisted value.
   */
  static from(value: string): EscrowId;
}

/**
 * Escrow aggregate root representing funds held in escrow for an errand.
 */
class Escrow extends AggregateRoot<EscrowId> {
  /**
   * Private constructor - use Escrow.create() factory method instead.
   * @param id Unique escrow identifier (from schema: id String @id)
   * @param errandId Unique errand identifier (from schema: errandId String @unique)
   * @param clientId Client who posted the errand (from schema: clientId String)
   * @param workerId Worker assigned to errand (from schema: workerId String)
   * @param amountGross Total escrow amount in kobo (from schema: amountGross Int)
   * @param platformFee Platform fee in kobo (from schema: platformFee Int)
   * @param amountNetWorker Net amount worker receives in kobo (from schema: amountNetWorker Int)
   * @param status Current escrow status (from schema: status EscrowStatus)
   * @param holdUntil Date until funds are auto-released if not disputed (from schema: holdUntil DateTime)
   * @param releasedAt Timestamp when released (from schema: releasedAt DateTime?)
   * @param refundedAt Timestamp when refunded (from schema: refundedAt DateTime?)
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: EscrowId,
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly workerId: ProviderId,
    private amountGross: Money,
    private platformFee: Money,
    private amountNetWorker: Money,
    private status: EscrowStatus,
    private holdUntil: Date | null,
    private releasedAt: Date | null,
    private refundedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
  * Factory method to create new escrow with PENDING status.
  * Splits gross amount into platform fee and net worker amount using provided fee rate.
  * Hold period is not started at creation. It starts after completion via hold().
   * @param errandId Unique errand identifier (must not already have escrow)
   * @param clientId Client posting errand
   * @param workerId Worker assigned to errand
   * @param amountGross Total amount in kobo (must be positive)
   * @param platformFeeRate Fee as basis points 0-10000 (e.g., 500 = 5%)
   * @throws InvalidAmountError when amountGross <= 0
   * @throws InvalidFeeRateError when platformFeeRate < 0 or > 10000 basis points
   * @returns New Escrow instance with status = PENDING
   */
  static create(
    errandId: ErrandId,
    clientId: ClientId,
    workerId: ProviderId,
    amountGross: Money,
    platformFeeRate: number,
  ): Escrow;

  /**
   * Reconstitutes Escrow aggregate from persistence.
   */
  static reconstitute(
    id: EscrowId,
    errandId: ErrandId,
    clientId: ClientId,
    workerId: ProviderId,
    amountGross: Money,
    platformFee: Money,
    amountNetWorker: Money,
    status: EscrowStatus,
    holdUntil: Date | null,
    releasedAt: Date | null,
    refundedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): Escrow;

  /**
   * Transitions escrow from PENDING → FUNDED after payment charge succeeds.
   * Should be called by FundEscrowCommandHandler after Paystack charge confirmation.
   * @throws InvalidStatusTransitionError when current status is not PENDING
   * @emits EscrowFundedEvent
   */
  fund(): void;

  /**
   * Transitions escrow from FUNDED → HELD after errand completion.
   * Sets holdUntil to completion time plus 3 days.
   * @param completedAt Timestamp when errand was completed
   * @throws InvalidStatusTransitionError when current status is not FUNDED
   */
  hold(completedAt: Date): void;

  /**
   * Begins release process (HELD → RELEASING) when errand completes.
   * Release is async (worker wallet credit happens in background), so intermediate
   * RELEASING status is used until confirmation.
   * @throws InvalidStatusTransitionError when current status is not HELD
   * @emits EscrowReleasingEvent
   */
  beginRelease(): void;

  /**
   * Completes release (RELEASING → RELEASED) after funds are credited to worker wallet.
   * @param releasedAt Timestamp of successful wallet credit
   * @throws InvalidStatusTransitionError when status is not RELEASING
   * @emits EscrowReleasedEvent
   */
  completeRelease(releasedAt: Date): void;

  /**
   * Begins refund process (HELD → REFUNDING) when errand is cancelled or disputed.
   * @param reason Reason for refund (ERRAND_CANCELLED | WORKER_NO_SHOW | DISPUTE_RESOLVED)
   * @throws InvalidStatusTransitionError when status is not HELD
   * @emits EscrowRefundingEvent
   */
  beginRefund(reason: RefundReason): void;

  /**
   * Completes refund (REFUNDING → REFUNDED) after funds are returned to client.
   * @param refundedAt Timestamp of successful refund
   * @throws InvalidStatusTransitionError when status is not REFUNDING
   * @emits EscrowRefundedEvent
   */
  completeRefund(refundedAt: Date): void;

  /**
   * Freezes escrow (HELD → DISPUTED) when a dispute is opened.
   * @throws InvalidStatusTransitionError when status is not HELD
   * @emits EscrowDisputedEvent
   */
  dispute(): void;

  /**
   * Checks if escrow hold period has expired (current time > holdUntil).
   * Used by scheduled job to auto-release funds to worker after hold period.
   * @returns true if funds can be auto-released to worker
   */
  isHoldExpired(): boolean;

  // Getters
  get amountGross(): Money {
    return this._amountGross;
  }
  get platformFee(): Money {
    return this._platformFee;
  }
  get amountNetWorker(): Money {
    return this._amountNetWorker;
  }
  get status(): EscrowStatus {
    return this._status;
  }
  get holdUntil(): Date | null {
    return this._holdUntil;
  }
  get releasedAt(): Date | null {
    return this._releasedAt;
  }
  get refundedAt(): Date | null {
    return this._refundedAt;
  }

  // Domain event management is inherited from AggregateRoot<TId>.
}

/**
 * Money value object representing an amount in a specific currency.
 * Immutable. Validates amount is non-negative.
 * Replaces raw integer kobo amounts to enforce type safety and prevent currency mixing.
 */
class Money {
  private constructor(
    public readonly amountKobo: number,
    public readonly currency: Currency,
  ) {
    if (amountKobo < 0) {
      throw new InvalidAmountError('Money amount cannot be negative');
    }
  }

  /**
   * Creates Money from kobo (smallest unit). 1 Naira = 100 kobo.
   * @param amountKobo Amount in kobo (must be >= 0)
   * @param currency Currency code (default: NGN)
   * @throws InvalidAmountError when amountKobo < 0
   */
  static fromKobo(amountKobo: number, currency: Currency = 'NGN'): Money {
    return new Money(amountKobo, currency);
  }

  /**
   * Creates Money from major unit (Naira). Converts to kobo internally.
   * @param amountNaira Amount in Naira (e.g., 100.50 → 10050 kobo)
   * @param currency Currency code (default: NGN)
   */
  static fromNaira(amountNaira: number, currency: Currency = 'NGN'): Money {
    return new Money(Math.round(amountNaira * 100), currency);
  }

  /**
   * Adds two Money values. Must have same currency.
   * @throws CurrencyMismatchError when currencies differ
   */
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    return Money.fromKobo(this.amountKobo + other.amountKobo, this.currency);
  }

  /**
   * Subtracts two Money values. Must have same currency.
   * @throws CurrencyMismatchError when currencies differ
   * @throws NegativeAmountError when result would be negative
   */
  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    if (this.amountKobo < other.amountKobo) {
      throw new NegativeAmountError(
        'Subtraction would result in negative amount',
      );
    }
    return Money.fromKobo(this.amountKobo - other.amountKobo, this.currency);
  }

  /**
   * Multiplies amount by a rate (for calculating fees).
   * @param rate Multiplier (e.g., 0.05 for 5%)
   */
  multiplyBy(rate: number): Money {
    return Money.fromKobo(Math.round(this.amountKobo * rate), this.currency);
  }

  /**
   * Divides amount into platformFee and netAmount using basis points.
   * Used by Escrow.create to split gross amount into fee + worker amount.
   * @param basisPoints Platform fee as basis points (e.g., 500 = 5%)
   * @returns [platformFee, netAmount] where platformFee + netAmount = this
   */
  splitFee(basisPoints: number): [Money, Money] {
    const feeAmount = Math.round((this.amountKobo * basisPoints) / 10000);
    const platformFee = Money.fromKobo(feeAmount, this.currency);
    const netAmount = Money.fromKobo(
      this.amountKobo - feeAmount,
      this.currency,
    );
    return [platformFee, netAmount];
  }

  toKobo(): number {
    return this.amountKobo;
  }
  toNaira(): number {
    return this.amountKobo / 100;
  }
  toString(): string {
    return `₦${this.toNaira().toFixed(2)}`;
  }

  equals(other: Money): boolean {
    return (
      this.amountKobo === other.amountKobo && this.currency === other.currency
    );
  }
}

/** Domain errors for Escrow aggregate. */
class InvalidStatusTransitionError extends Error {
  constructor(from: EscrowStatus, to: EscrowStatus) {
    super(`Cannot transition escrow from ${from} to ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

class InvalidFeeRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFeeRateError';
  }
}

class CurrencyMismatchError extends Error {
  constructor(currency1: Currency, currency2: Currency) {
    super(`Cannot mix currencies: ${currency1} and ${currency2}`);
    this.name = 'CurrencyMismatchError';
  }
}

class NegativeAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NegativeAmountError';
  }
}

enum EscrowStatus {
  PENDING = 'PENDING',
  FUNDED = 'FUNDED',
  HELD = 'HELD',
  RELEASING = 'RELEASING',
  RELEASED = 'RELEASED',
  REFUNDING = 'REFUNDING',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

enum RefundReason {
  ERRAND_CANCELLED = 'ERRAND_CANCELLED',
  WORKER_NO_SHOW = 'WORKER_NO_SHOW',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
}

type Currency = 'NGN'; // Extend later for multi-currency support
```

### Repository Interface

```typescript
/**
 * Persistence-ignorant contract for Escrow aggregate.
 * Implemented by infrastructure layer (PrismaEscrowRepository).
 * Domain and application layers depend only on this interface.
 */
interface IEscrowRepository {
  /**
   * Finds escrow by ID.
   * @returns Escrow aggregate or null if not found
   */
  findById(id: EscrowId): Promise<Escrow | null>;

  /**
   * Finds escrow by errand ID (1:1 relationship enforced by unique constraint).
   * Used by FundEscrowCommandHandler to check if escrow already exists (idempotency).
   * @returns Escrow aggregate or null if not found
   */
  findByErrandId(errandId: ErrandId): Promise<Escrow | null>;

  /**
   * Finds all escrows for a client (for admin dashboard).
   * @param clientId Client's user ID
   * @param status Optional status filter
   * @returns Array of Escrow aggregates ordered by createdAt desc
   */
  findByClientId(clientId: ClientId, status?: EscrowStatus): Promise<Escrow[]>;

  /**
   * Finds all escrows for a worker (for provider dashboard).
   * @param workerId Worker's provider ID
   * @param status Optional status filter
   * @returns Array of Escrow aggregates ordered by createdAt desc
   */
  findByWorkerId(
    workerId: ProviderId,
    status?: EscrowStatus,
  ): Promise<Escrow[]>;

  /**
   * Finds all escrows with expired hold periods (for auto-release scheduled job).
   * Query: status = HELD AND holdUntil < NOW()
   * @returns Array of Escrow aggregates ready for auto-release
   */
  findExpiredHolds(): Promise<Escrow[]>;

  /**
   * Persists escrow (insert if new, update if exists).
   * Maps Money value objects to integer kobo in Prisma schema.
   * Publishes domain events to event bus after save.
   * @param escrow Escrow aggregate to save
   */
  save(escrow: Escrow): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Funds escrow for an errand after application is accepted.
 * Part of AcceptApplicationSaga - this is step 2 (after ApplicationAccepted event).
 * Orchestrates: Create escrow → charge payment → hold client wallet funds.
 */
class FundEscrowCommandHandler {
  constructor(
    private readonly escrowRepository: IEscrowRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly paymentGatewayService: IPaymentGatewayService,
    private readonly platformFeeRate: number, // Injected from config
    private readonly logger: ILogger,
  ) {}

  /**
   * @param command Contains errandId, clientId, workerId, amountGross, paymentMethodId
   * @throws EscrowAlreadyExistsError when errand already has escrow (idempotency check)
   * @throws PaymentMethodNotFoundError when paymentMethodId invalid
   * @throws InsufficientFundsError when payment charge fails
   * @throws WalletNotFoundError when client wallet doesn't exist
   * @emits EscrowFunded when escrow created and payment charged successfully
   */
  async execute(command: FundEscrowCommand): Promise<FundEscrowResult> {
    // 1. Idempotency check
    const existing = await this.escrowRepository.findByErrandId(
      command.errandId,
    );
    if (existing) {
      throw new EscrowAlreadyExistsError(command.errandId);
    }

    // 2. Create escrow aggregate (PENDING status)
    const escrow = Escrow.create(
      command.errandId,
      command.clientId,
      command.workerId,
      command.amountGross,
      this.platformFeeRate,
    );

    // 3. Charge payment via payment gateway
    const chargeResult = await this.paymentGatewayService.chargePaymentMethod(
      command.paymentMethodId,
      escrow.amountGross,
      `Escrow for errand ${command.errandId}`,
    );

    if (!chargeResult.success) {
      this.logger.error('Payment charge failed', chargeResult.error);
      throw new InsufficientFundsError(chargeResult.error);
    }

    // 4. Transition escrow to FUNDED
    escrow.fund();

    // 5. Hold funds in client wallet
    const clientWallet = await this.walletRepository.findByUserId(
      command.clientId,
    );
    if (!clientWallet) {
      throw new WalletNotFoundError(command.clientId);
    }
    clientWallet.hold(escrow.amountGross, `Escrow ${escrow.id}`);

    // 6. Persist escrow + wallet (publishes EscrowFunded event)
    await this.escrowRepository.save(escrow);
    await this.walletRepository.save(clientWallet);

    return {
      escrowId: escrow.id,
      amountGross: escrow.amountGross,
      platformFee: escrow.platformFee,
      amountNetWorker: escrow.amountNetWorker,
    };
  }
}

interface FundEscrowCommand {
  errandId: ErrandId;
  clientId: ClientId;
  workerId: ProviderId;
  amountGross: Money;
  paymentMethodId: PaymentMethodId;
}

interface FundEscrowResult {
  escrowId: EscrowId;
  amountGross: Money;
  platformFee: Money;
  amountNetWorker: Money;
}

/**
 * Releases escrow funds to worker wallet when errand is completed.
 * Triggered by ErrandCompleted event (event handler calls this).
 * Orchestrates: Begin release → credit worker wallet → complete release.
 */
class ReleaseEscrowCommandHandler {
  constructor(
    private readonly escrowRepository: IEscrowRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * @param command Contains escrowId
   * @throws EscrowNotFoundError when escrowId invalid
   * @throws InvalidStatusTransitionError when escrow not in HELD status
   * @throws WalletNotFoundError when worker wallet doesn't exist
   * @throws WalletCreditFailedError when worker wallet credit fails (queued for retry)
   * @emits EscrowReleasing when release begins
   * @emits EscrowReleased when funds credited to worker wallet
   */
  async execute(command: ReleaseEscrowCommand): Promise<void> {
    // 1. Load escrow
    const escrow = await this.escrowRepository.findById(command.escrowId);
    if (!escrow) {
      throw new EscrowNotFoundError(command.escrowId);
    }

    // 2. Begin release (HELD → RELEASING)
    escrow.beginRelease();
    await this.escrowRepository.save(escrow); // Emits EscrowReleasingEvent

    // 3. Credit worker wallet
    const workerWallet = await this.walletRepository.findByUserId(
      escrow.workerId,
    );
    if (!workerWallet) {
      throw new WalletNotFoundError(escrow.workerId);
    }

    try {
      workerWallet.credit(
        escrow.amountNetWorker,
        `Escrow release ${escrow.id}`,
      );
      await this.walletRepository.save(workerWallet);
    } catch (error) {
      this.logger.error('Worker wallet credit failed', error);
      throw new WalletCreditFailedError(error);
    }

    // 4. Complete release (RELEASING → RELEASED)
    escrow.completeRelease(new Date());
    await this.escrowRepository.save(escrow); // Emits EscrowReleasedEvent
  }
}

interface ReleaseEscrowCommand {
  escrowId: EscrowId;
}

/**
 * Refunds escrow funds to client when errand is cancelled.
 * Triggered by ErrandCancelled event.
 * Orchestrates: Begin refund → Paystack refund → complete refund.
 */
class RefundEscrowCommandHandler {
  constructor(
    private readonly escrowRepository: IEscrowRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly paymentGatewayService: IPaymentGatewayService,
    private readonly logger: ILogger,
  ) {}

  /**
   * @param command Contains escrowId and reason
   * @throws EscrowNotFoundError when escrowId invalid
   * @throws InvalidStatusTransitionError when escrow not in HELD status
   * @throws RefundFailedError when Paystack refund fails (queued for retry in BullMQ)
   * @emits EscrowRefunding when refund begins
   * @emits EscrowRefunded when refund confirmed by payment gateway
   */
  async execute(command: RefundEscrowCommand): Promise<void> {
    // 1. Load escrow
    const escrow = await this.escrowRepository.findById(command.escrowId);
    if (!escrow) {
      throw new EscrowNotFoundError(command.escrowId);
    }

    // 2. Release held funds in client wallet first
    const clientWallet = await this.walletRepository.findByUserId(
      escrow.clientId,
    );
    if (clientWallet) {
      clientWallet.release(escrow.amountGross, `Escrow refund ${escrow.id}`);
      await this.walletRepository.save(clientWallet);
    }

    // 3. Begin refund (HELD → REFUNDING)
    escrow.beginRefund(command.reason);
    await this.escrowRepository.save(escrow); // Emits EscrowRefundingEvent

    // 4. Refund via payment gateway
    try {
      const refundResult = await this.paymentGatewayService.refund(
        escrow.amountGross,
        `Escrow refund ${escrow.id}`,
      );

      if (!refundResult.success) {
        throw new RefundFailedError(refundResult.error);
      }
    } catch (error) {
      this.logger.error('Paystack refund failed - queuing for retry', error);
      throw new RefundFailedError(error);
    }

    // 5. Complete refund (REFUNDING → REFUNDED)
    escrow.completeRefund(new Date());
    await this.escrowRepository.save(escrow); // Emits EscrowRefundedEvent
  }
}

interface RefundEscrowCommand {
  escrowId: EscrowId;
  reason: RefundReason;
}

/**
 * Query handler for fetching escrow details (read model).
 * Used by GraphQL resolvers to display escrow info in client/provider dashboards.
 */
class GetEscrowByErrandQueryHandler {
  constructor(private readonly escrowRepository: IEscrowRepository) {}

  /**
   * @param query Contains errandId
   * @returns Escrow DTO or null if not found
   */
  async execute(query: GetEscrowByErrandQuery): Promise<EscrowDTO | null> {
    const escrow = await this.escrowRepository.findByErrandId(query.errandId);
    if (!escrow) {
      return null;
    }

    return {
      id: escrow.id,
      errandId: escrow.errandId,
      clientId: escrow.clientId,
      workerId: escrow.workerId,
      amountGross: escrow.amountGross.toKobo(),
      platformFee: escrow.platformFee.toKobo(),
      amountNetWorker: escrow.amountNetWorker.toKobo(),
      status: escrow.status,
      holdUntil: escrow.holdUntil,
      releasedAt: escrow.releasedAt,
      refundedAt: escrow.refundedAt,
    };
  }
}

interface GetEscrowByErrandQuery {
  errandId: ErrandId;
}

interface EscrowDTO {
  id: EscrowId;
  errandId: ErrandId;
  clientId: ClientId;
  workerId: ProviderId;
  amountGross: number; // In kobo
  platformFee: number;
  amountNetWorker: number;
  status: EscrowStatus;
  holdUntil: Date;
  releasedAt: Date | null;
  refundedAt: Date | null;
}

/** Application errors */
class EscrowAlreadyExistsError extends Error {}
class EscrowNotFoundError extends Error {}
class PaymentMethodNotFoundError extends Error {}
class InsufficientFundsError extends Error {}
class WalletNotFoundError extends Error {}
class WalletCreditFailedError extends Error {}
class RefundFailedError extends Error {}
```

### Domain Events

```typescript
/**
 * Emitted when escrow is funded (payment charged successfully).
 * Consumed by:
 * - WalletEventHandler (holds funds in client wallet) — already handled in command
 * - NotificationEventHandler (notifies client "Payment successful")
 * - AcceptApplicationSaga (proceeds to step 3: assign errand)
 */
class EscrowFundedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly workerId: ProviderId,
    public readonly amountGross: Money,
    public readonly platformFee: Money,
    public readonly amountNetWorker: Money,
    public readonly occurredAt: Date,
  );

  static fromAggregate(escrow: Escrow): EscrowFundedEvent {
    return new EscrowFundedEvent(
      escrow.id,
      escrow.errandId,
      escrow.clientId,
      escrow.workerId,
      escrow.amountGross,
      escrow.platformFee,
      escrow.amountNetWorker,
      new Date(),
    );
  }
}

/**
 * Emitted when escrow release begins (errand completed).
 * Consumed by:
 * - WalletEventHandler (prepares to credit worker — already handled in ReleaseEscrowCommandHandler)
 */
class EscrowReleasingEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: ErrandId,
    public readonly workerId: ProviderId,
    public readonly amount: Money,
    public readonly occurredAt: Date,
  );

  static fromAggregate(escrow: Escrow): EscrowReleasingEvent {
    return new EscrowReleasingEvent(
      escrow.id,
      escrow.errandId,
      escrow.workerId,
      escrow.amountNetWorker,
      new Date(),
    );
  }
}

/**
 * Emitted when escrow is fully released (worker wallet credited).
 * Consumed by:
 * - NotificationEventHandler (notifies worker "Payment received")
 * - RatingEventHandler (sends rating request to both client and worker)
 */
class EscrowReleasedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: ErrandId,
    public readonly workerId: ProviderId,
    public readonly amount: Money,
    public readonly occurredAt: Date,
  );

  static fromAggregate(escrow: Escrow): EscrowReleasedEvent {
    return new EscrowReleasedEvent(
      escrow.id,
      escrow.errandId,
      escrow.workerId,
      escrow.amountNetWorker,
      escrow.releasedAt!,
    );
  }
}

/**
 * Emitted when escrow refund begins (errand cancelled).
 * Consumed by:
 * - PaymentGatewayEventHandler (initiates Paystack refund — already handled in command)
 */
class EscrowRefundingEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly amount: Money,
    public readonly reason: RefundReason,
    public readonly occurredAt: Date,
  );

  static fromAggregate(
    escrow: Escrow,
    reason: RefundReason,
  ): EscrowRefundingEvent {
    return new EscrowRefundingEvent(
      escrow.id,
      escrow.errandId,
      escrow.clientId,
      escrow.amountGross,
      reason,
      new Date(),
    );
  }
}

/**
 * Emitted when escrow is fully refunded (client received refund).
 * Consumed by:
 * - NotificationEventHandler (notifies client "Refund processed")
 */
class EscrowRefundedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly amount: Money,
    public readonly occurredAt: Date,
  );

  static fromAggregate(escrow: Escrow): EscrowRefundedEvent {
    return new EscrowRefundedEvent(
      escrow.id,
      escrow.errandId,
      escrow.clientId,
      escrow.amountGross,
      escrow.refundedAt!,
    );
  }
}

/**
 * Emitted when escrow is disputed (dispute opened).
 * Consumed by:
 * - DisputeEventHandler (creates Dispute aggregate)
 * - NotificationEventHandler (notifies admin team)
 */
class EscrowDisputedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: ErrandId,
    public readonly occurredAt: Date,
  );

  static fromAggregate(escrow: Escrow): EscrowDisputedEvent {
    return new EscrowDisputedEvent(escrow.id, escrow.errandId, new Date());
  }
}
```

### Saga

```typescript
/**
 * Orchestrates errand assignment + escrow funding across Application, Escrow, Errand, Wallet aggregates.
 * Replaces the god method EscrowService.acceptApplicationAndFundEscrow (110 lines).
 *
 * Flow:
 * 1. Application accepted → funds escrow (charges payment)
 * 2. Escrow funded
 * 3. Wallet funds held → assigns errand to worker
 * 4. Errand assigned → cancels other pending applications
 * 5. Applications cancelled → notifies workers
 *
 * Compensation (if any step fails):
 * - If escrow funding fails (payment declined) → rejects application, notifies client
 * - If wallet hold fails → refunds escrow, rejects application
 * - If errand assignment fails → refunds escrow, releases wallet hold, rejects application
 */
class AcceptApplicationSaga {
  constructor(
    private readonly fundEscrowHandler: FundEscrowCommandHandler,
    private readonly assignErrandHandler: AssignErrandCommandHandler,
    private readonly rejectApplicationHandler: RejectApplicationCommandHandler,
    private readonly cancelApplicationsHandler: CancelOtherApplicationsCommandHandler,
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger,
  ) {}

  /**
   * Step 1: Listen to ApplicationAccepted event, fund escrow.
   * @listens ApplicationAcceptedEvent (emitted by Application.accept())
   * @emits EscrowFunded (success) or compensates by rejecting application (failure)
   */
  async onApplicationAccepted(event: ApplicationAcceptedEvent): Promise<void> {
    try {
      await this.fundEscrowHandler.execute({
        errandId: event.errandId,
        clientId: event.clientId,
        workerId: event.workerId,
        amountGross: event.agreedAmount,
        paymentMethodId: event.paymentMethodId,
      });
      // EscrowFunded event emitted automatically by repository
    } catch (error) {
      this.logger.error('Escrow funding failed - compensating', error);
      await this.compensateApplicationAccepted(event, error);
    }
  }

  /**
   * Step 2: Listen to EscrowFunded event, assign errand to worker.
   * @listens EscrowFundedEvent
   * @emits ErrandAssigned (success) or compensates by refunding escrow (failure)
   */
  async onEscrowFunded(event: EscrowFundedEvent): Promise<void> {
    try {
      await this.assignErrandHandler.execute({
        errandId: event.errandId,
        workerId: event.workerId,
      });
      // ErrandAssigned event emitted automatically by Errand aggregate
    } catch (error) {
      this.logger.error('Errand assignment failed - compensating', error);
      await this.compensateEscrowFunded(event, error);
    }
  }

  /**
   * Step 3: Listen to ErrandAssigned event, cancel other pending applications.
   * @listens ErrandAssignedEvent
   * @emits ApplicationsCancelled (success)
   */
  async onErrandAssigned(event: ErrandAssignedEvent): Promise<void> {
    await this.cancelApplicationsHandler.execute({
      errandId: event.errandId,
      excludeApplicationId: event.applicationId,
    });
    // ApplicationsCancelled event emitted automatically
  }

  /**
   * Compensation for failed escrow funding.
   * Rejects the application and notifies client of payment failure.
   */
  private async compensateApplicationAccepted(
    event: ApplicationAcceptedEvent,
    error: Error,
  ): Promise<void> {
    await this.rejectApplicationHandler.execute({
      applicationId: event.applicationId,
      reason: `Payment failed: ${error.message}`,
    });
    this.eventBus.publish(
      new ApplicationRejectedEvent(
        event.applicationId,
        event.errandId,
        event.workerId,
        `Payment declined`,
      ),
    );
  }

  /**
   * Compensation for failed errand assignment.
   * Refunds escrow and rejects application.
   */
  private async compensateEscrowFunded(
    event: EscrowFundedEvent,
    error: Error,
  ): Promise<void> {
    // Refund escrow
    const refundHandler = new RefundEscrowCommandHandler(/* deps */);
    await refundHandler.execute({
      escrowId: event.escrowId,
      reason: RefundReason.ERRAND_CANCELLED,
    });

    // Reject application
    await this.rejectApplicationHandler.execute({
      applicationId: event.applicationId,
      reason: `Assignment failed: ${error.message}`,
    });
  }
}
```
