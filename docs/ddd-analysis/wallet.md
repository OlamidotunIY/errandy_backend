# Wallet — DDD & EIP Analysis

## 1. Current Responsibility

**Intended to manage user wallet balances** (available funds + held funds) and transaction ledger. However:

- `WalletService` is a **stub** with placeholder methods returning strings like `'This action adds a new wallet'`.
- `WalletResolver` has CRUD scaffolding but no real implementation.
- Actual wallet logic is **scattered across other modules**:
  - `EscrowService` creates wallet transactions (`this.prisma.transaction.create`, line ~150 in escrow.service.ts).
  - `PaymentGatewayService` updates wallet balance during refund fallback (`this.prisma.wallet.update`, line ~150 in payment-gateway.service.ts).
  - No centralized service for wallet operations.

**Files**: `wallet.service.ts` (stub), `wallet.resolver.ts` (stub), `wallet.module.ts`.

## 2. Bounded Context Assessment

**This SHOULD be a real bounded context** for "Wallet & Ledger Management", but it's currently **degenerate** — the domain logic lives elsewhere.

**Overlaps**:

- **Escrow**: Creates `ESCROW_HOLD` and `ESCROW_RELEASE` transactions, updates wallet balances during escrow flow.
- **Payment-Gateway**: Credits wallet as fallback when Paystack refunds fail.
- **Errands** (indirectly): Errand completion triggers wallet credit via escrow release.

**Verdict**: Wallet is a missing bounded context — the domain exists in the Prisma schema (`Wallet`, `Transaction` models), but the domain logic is **leaking into Escrow and Payment-Gateway modules**.

## 3. Domain Model Audit

**Anemic models**:

- `Wallet` (Prisma model): Has fields `available`, `held`, `currency`, but no behavior.
  - Missing methods: `debit()`, `credit()`, `hold()`, `release()`, `canWithdraw()`.
- `Transaction` (Prisma model): Ledger entry with `type`, `status`, `amount`, but no behavior.
  - Missing invariants: Cannot have negative amount, status must transition `PENDING` → `SUCCESS` | `FAILED`.

**Aggregate boundaries**:

- **`Wallet`** should be the aggregate root, owning:
  - `Transaction` (child entities — ledger is an append-only log of wallet operations).
  - Invariants: `available >= 0`, `held >= 0`, `available + held` matches sum of transactions.
- **Wallet operations as methods**:
  - `creditAvailable(amount, reference)` → creates `FUND` transaction, increments `available`.
  - `debitAvailable(amount, reference)` → creates `WITHDRAWAL` transaction, decrements `available`.
  - `holdFunds(amount, reference)` → creates `ESCROW_HOLD` transaction, decrements `available`, increments `held`.
  - `releaseFunds(amount, reference)` → creates `ESCROW_RELEASE` transaction, decrements `held`, credits target wallet.

**Invariants currently unenforced**:

1. **Balance integrity**:
   - Escrow service manually updates wallet (line ~150 in escrow): `prisma.wallet.update({ data: { available: { increment: refundAmountKobo } } })` — no check that increment doesn't overflow or cause negative balance.
   - Payment-gateway service does the same (line ~150 in payment-gateway.service.ts).
   - No guard preventing concurrent updates (race condition: two escrow releases could double-credit).
2. **Transaction uniqueness**:
   - Transactions use `reference` field as unique key (e.g., `ESCROW_HOLD:${errandId}`), but uniqueness is enforced at DB level, not domain level.
   - No domain logic preventing duplicate transaction creation (relies on Prisma unique constraint to throw).
3. **Ledger immutability**:
   - Transactions are append-only in theory, but Prisma allows `update` and `delete` on `Transaction` model — no domain guard.

## 4. Layering Violations

**Business logic scattered**:

- Escrow module creates wallet transactions directly:

  ```typescript
  await tx.transaction.upsert({
    where: { reference: `ESCROW_HOLD:${errand.id}` },
    update: {},
    create: { ownerId, ownerType, amount, type: 'ESCROW_HOLD', ... }
  })
  ```

  This is wallet domain logic (ledger creation) in the escrow module.

- Payment-gateway module updates wallet balance:
  ```typescript
  await this.prisma.wallet.update({
    where: { id: wallet.id },
    data: { available: { increment: refundAmountKobo } },
  });
  ```
  This is a wallet debit/credit operation in the payment module.

**Persistence leaking**:

- Other modules directly call `this.prisma.wallet.*` and `this.prisma.transaction.*` — bypassing any wallet service.

## 5. Repository Pattern Gap

**Current state**: No repository. Wallet data is accessed directly via Prisma from Escrow and Payment-Gateway modules.

**Proposed**:

```
domain/
  IWalletRepository (interface)
    - findByOwner(ownerId, ownerType): Wallet | null
    - save(wallet): void
    - findTransactionByReference(reference): Transaction | null
infrastructure/
  PrismaWalletRepository (implementation)
```

**Consolidation**: All `prisma.wallet.*` and `prisma.transaction.*` calls in Escrow and Payment-Gateway modules are replaced with calls to `WalletService` (which uses repository internally).

## 6. EIP Opportunities

**Command/Event patterns** (critical for consistency):

1. **Wallet operations as events**:
   - Current: Escrow directly mutates wallet in a transaction (line ~150).
   - Proposed: Escrow emits `FundsHeld` event → Wallet module listens → creates `ESCROW_HOLD` transaction → updates balance.
   - Benefits: Wallet module owns its own consistency, escrow doesn't need to know wallet schema.

2. **Idempotency via Command pattern**:
   - Current: `upsert` on transaction table (line ~150 in escrow) tries to ensure idempotency, but logic is scattered.
   - Proposed: `HoldFundsCommand` with unique `reference` → handler checks if transaction exists before creating.

3. **Eventual consistency**:
   - Escrow release and wallet credit could be asynchronous:
     - Escrow emits `EscrowReleased` event.
     - Wallet listens, credits worker wallet.
     - If wallet update fails (DB down), event is retried from queue.

**Dead Letter Channel / Retry**:

- Current: If wallet update fails (e.g., DB timeout during escrow release), the escrow is marked `RELEASED` but wallet balance is NOT updated — **money is lost in the system**.
- No compensation or retry.
- Recommendation: Wallet operations as queued commands (BullMQ), retried 5x before dead-letter.

**Aggregator**:

- Wallet balance is an aggregation of transaction history: `available = SUM(transactions where status=SUCCESS)`.
- Currently recalculated on the fly via Prisma increment/decrement.
- Better: Use event sourcing for wallet — rebuild balance from transaction log (audit-friendly, no race conditions).

## 7. Cross-Cutting Concerns

**Validation**:

- No validation of wallet operations (e.g., can debit more than available balance if Prisma increment goes negative).
- Amount validation is missing (can create transaction with `amount = 0` or `amount < 0`).

**Transactions**:

- Wallet updates are done inside transactions started by other modules (Escrow's `prisma.$transaction`), meaning wallet consistency depends on escrow logic correctness.
- Should be: Wallet module owns its own transactions, triggered by events from other modules.

**Error handling**:

- If wallet update fails, error bubbles up to escrow/payment-gateway caller (e.g., GraphQL resolver sees `500 Internal Server Error`).
- No domain exception for `InsufficientFunds`, `WalletNotFound`.

## 8. GraphQL-Specific Notes

**No real GraphQL exposure**:

- `WalletResolver` exists but is a stub (returns placeholder strings).
- Wallet is not exposed to clients directly — clients see wallet balance via `User` or `Client` queries (if implemented).

**Should there be a resolver?**

- Potentially yes, for queries like:
  - `myWalletBalance` → returns available + held funds.
  - `myTransactionHistory(pagination)` → ledger query.
  - `withdrawFunds(amount)` → mutation to request withdrawal.

**Authorization**:

- No auth implemented yet (stub service).
- When implemented, must enforce: users can only query/mutate their own wallet.

## 9. Target Structure

```
src/wallet/
  domain/
    entities/
      Wallet.ts                     # Aggregate root with credit(), debit(), hold(), release()
      Transaction.ts                # Child entity (ledger entry)
    value-objects/
      Money.ts                      # Shared with Escrow
      TransactionReference.ts       # Unique reference for idempotency
    repositories/
      IWalletRepository.ts          # Interface: findByOwner, save, findTransactionByReference
    events/
      FundsHeld.ts
      FundsReleased.ts
      FundsCredited.ts
      FundsDebited.ts

  application/
    commands/
      CreditWallet/
        CreditWalletCommand.ts
        CreditWalletHandler.ts
      HoldFunds/
        HoldFundsCommand.ts
        HoldFundsHandler.ts
      ReleaseFunds/
        ReleaseFundsCommand.ts
        ReleaseFundsHandler.ts
      WithdrawFunds/
        WithdrawFundsCommand.ts
        WithdrawFundsHandler.ts
    queries/
      GetWalletBalance/
        GetWalletBalanceQuery.ts
        GetWalletBalanceHandler.ts
      GetTransactionHistory/
        GetTransactionHistoryQuery.ts
        GetTransactionHistoryHandler.ts
    event-handlers/
      OnEscrowFundedHoldFunds.ts    # Listens to EscrowFunded → holds funds in client wallet
      OnEscrowReleasedCreditWorker.ts  # Listens to EscrowReleased → credits worker wallet

  infrastructure/
    repositories/
      PrismaWalletRepository.ts     # Implements IWalletRepository

  presentation/
    resolvers/
      WalletResolver.ts             # Queries: myWalletBalance, myTransactionHistory
                                    # Mutations: withdrawFunds
    types/
      WalletType.ts
      TransactionType.ts
```

---

## 10. Schema Findings

**Context**: Analysis of `prisma/model/wallet.prisma` and cross-module references.

### Aggregate Boundary Violations

1. **EscrowService creates Transactions directly**
   - **Evidence**: `src/escrow/escrow.service.ts` (~line 150) calls `prisma.transaction.create()` directly (creates `ESCROW_HOLD` transactions).
   - **Schema gap**: `Transaction` model has no ownership constraint enforcing that only Wallet module can create transactions.
   - **Impact**: **CRITICAL** — wallet balance can become inconsistent if transactions created outside Wallet aggregate (no invariant enforcement: balance = SUM(transactions)).
   - **Fix priority**: PHASE 1 — `EscrowFunded` event → `WalletEventHandler.holdFunds()` → creates transaction.
   - **Migration notes**: Requires dual-write during transition (emit events AND create transaction directly) to ensure no data loss during rollout.

2. **PaymentGatewayService updates Wallet.available directly**
   - **Evidence**: `src/payment-gateway/payment-gateway.service.ts` (line 180) calls `prisma.wallet.update({ data: { available: { increment } } })` directly.
   - **Schema gap**: No constraint preventing direct wallet mutations.
   - **Impact**: **CRITICAL** — balance updates bypass Wallet aggregate's invariants (available >= 0, ledger immutability).
   - **Fix priority**: PHASE 1 — `RefundFailed` event → `WalletEventHandler.creditRefund()`.

### Dangling Reference Risks

1. **Transaction.errandId → Errand (Financial audit trail at risk)**
   - **Schema**: `Transaction.errandId` is nullable `String? @db.ObjectId`, no cascade rule.
   - **Bug**: If errand deleted, all wallet transactions for that errand become orphaned — **cannot trace payment back to job**.
   - **Impact**: **CRITICAL** — audit compliance violation (financial records must link to originating transaction).
   - **Current cleanup**: None.
   - **Fix**: Add constraint to Errand schema (prevent errand deletion if transactions exist):
     ```prisma
     // In errand.prisma, add this check via code (Prisma doesn't support FK checks on nullable fields)
     // Or add event handler: ErrandDeleting → check if transactions exist → reject if found
     ```
   - **Alternative**: Use `onDelete: SetNull` to preserve transaction but clear errand link (acceptable for audit — transaction still shows amount/date).
   - **Migration**: Code-level check (no Prisma schema change possible for nullable FK).
   - **Priority**: PHASE 1 (before errand deletion feature built).

2. **Transaction.ownerId → Client/Provider (polymorphic relation risk)**
   - **Schema**: `Transaction.ownerId` + `ownerType` enum (CLIENT | PROVIDER) — polymorphic relation, no cascade rules.
   - **Bug**: Deleting client or provider orphans all their transactions.
   - **Impact**: **CRITICAL** — financial audit trail broken (cannot show user's payment history).
   - **Current cleanup**: None.
   - **Fix**: Add code-level check (prevent user deletion if wallet transactions exist) OR soft-delete users (mark inactive, preserve data).
   - **Priority**: PHASE 1 (coordinate with Users module — user deletion feature).

### Missing Indexes

**All critical indexes already present** (analysis confirmed):

- `@@unique([ownerId, ownerType])` on Wallet ✅
- `@@index([ownerId, ownerType])` on Transaction ✅
- `@@index([errandId])` on Transaction ✅
- `@@unique([reference])` on Transaction ✅

**No additional indexes needed** — Wallet/Transaction queries covered.

### Embed vs. Reference Decisions

**Not applicable** — Wallet has no denormalization proposals. Wallet balance is computed from transaction ledger (event sourcing pattern — rebuild from log).

**Note on balance integrity**:

- Current schema stores `Wallet.available` and `Wallet.held` as denormalized fields (updated on each transaction).
- **Risk**: If transaction creation succeeds but wallet update fails, balance becomes inconsistent.
- **Alternative**: Remove `available`/`held` fields, compute balance from `SUM(transactions)` on-demand.
- **Tradeoff**: Read performance vs. consistency.
- **Decision**: Keep current approach (denormalized balance) but add domain invariant: `Wallet.updateBalance()` method MUST be called inside same transaction as `Transaction.create()`.

### Migration / Rollback Strategy

**Phase 1 changes for Wallet**:

1. **Add cascade protections for transactions** (code-level):
   - Add event handler: `ErrandDeleting` → check if transactions exist → reject if found.
   - Add event handler: `UserDeleting` → check if wallet exists → reject if found (or soft-delete user).
   - Migration: Code deployment (no schema change).
   - Rollback: Code revert.
   - Risk: LOW.

2. **Extract Wallet aggregate + events** (code-only):
   - Create `Wallet.credit()`, `Wallet.debit()`, `Wallet.hold()`, `Wallet.release()` methods.
   - Emit events: `FundsCredited`, `FundsDebited`, `FundsHeld`, `FundsReleased`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: **MEDIUM** — requires dual-write during transition (emit events AND direct Prisma) to avoid breaking Escrow/Payment-Gateway.

3. **No schema changes needed** (no indexes/constraints to add).

4. **No backfill scripts needed** (existing wallet/transaction data is valid).

**Risk revised from LOW-MEDIUM to MEDIUM**: Dual-write complexity for coordinating Wallet aggregate with Escrow/Payment-Gateway makes this moderately risky. Requires feature flag + gradual rollout.

**Mitigation**: Use BullMQ queue for wallet operations (retry on failure) + monitoring (alert if transaction created but balance not updated).

---

## 11. Migration Risk & Priority

**Risk**: **LOW-MEDIUM**

- Wallet is currently a stub, so no existing functionality breaks if we implement it from scratch.
- However, wallet data is already in production DB (created by Escrow and Payment-Gateway modules), so migration must preserve existing transactions.

**Priority**: **PHASE 1 (parallel with Escrow)**
**Rationale**:

1. Wallet refactoring UNBLOCKS Escrow refactoring (escrow should emit events instead of mutating wallet directly).
2. Implementing wallet properly prevents money loss bugs (currently wallet updates can fail silently).
3. Low-risk because current implementation is a stub — we're adding functionality, not changing it.

**Migration steps**:

1. **Implement Wallet aggregate** with `credit()`, `debit()`, `hold()`, `release()` methods.
2. **Create WalletService** with use case methods: `creditWallet()`, `holdFunds()`, `releaseFunds()`.
3. **Extract wallet mutation calls from Escrow and Payment-Gateway** → replace with `WalletService` calls.
4. **Introduce event-driven wallet updates**:
   - Escrow emits `EscrowFunded` → Wallet listens → holds funds.
   - Escrow emits `EscrowReleased` → Wallet listens → releases funds + credits worker.
5. **Add GraphQL resolver** for wallet queries (balance, transaction history).
6. **Queue wallet operations** in BullMQ for retry on failure.
7. **Audit existing wallet transactions** in DB for consistency (sum of transactions should match wallet balances).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Wallet aggregate root managing user balances and fund movements.
 * Core invariants:
 * - available + held must always equal the sum of all ledger entries
 * - available and held balances must never go negative
 * - All balance changes must be recorded as immutable Transaction entities
 * - One wallet per user (ownerId + ownerType composite is unique)
 */
class WalletId extends EntityId {
  /**
   * Private constructor. Use WalletId.new() or WalletId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new WalletId.
   */
  static new(): WalletId;

  /**
   * Rehydrates WalletId from persisted value.
   */
  static from(value: string): WalletId;
}

/**
 * Wallet aggregate root managing user balances and fund movements.
 */
class Wallet extends AggregateRoot<WalletId> {
  /**
   * Private constructor - use Wallet.create() factory or load from repository.
   * @param id Unique wallet identifier (from schema: id String @id)
   * @param ownerId User ID who owns wallet (from schema: ownerId String)
   * @param ownerType Owner type enum (from schema: ownerType OwnerType)
   * @param available Available balance in kobo (from schema: available Int)
   * @param held Held balance in kobo (from schema: held Int)
   * @param transactions Immutable ledger of all balance changes (from schema: Transaction[])
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: WalletId,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly ownerType: OwnerType,
    private available: number,
    private held: number,
    private readonly transactions: Transaction[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Factory method to create new wallet with zero balances.
   * @param ownerId User ID
   * @param ownerType USER | PROVIDER | CLIENT
   * @returns New Wallet instance with available=0, held=0
   */
  static create(ownerId: UserId | ProviderId | ClientId, ownerType: OwnerType): Wallet;

  /**
   * Reconstitutes Wallet aggregate from persistence.
   */
  static reconstitute(
    id: WalletId,
    ownerId: UserId | ProviderId | ClientId,
    ownerType: OwnerType,
    available: number,
    held: number,
    transactions: Transaction[],
    createdAt: Date,
    updatedAt: Date,
  ): Wallet;

  /**
   * Increases available balance and creates CREDIT transaction.
   * Must enforce non-negative balance invariant.
   * @param amount Amount to credit in kobo (must be > 0)
   * @param source Transaction source (e.g., "escrow_release", "refund", "topup")
   * @param reference External reference (e.g., escrow ID, payment reference)
   * @param errandId Optional errand ID if credit is errand-related
   * @throws InvalidAmountError when amount <= 0
   * @throws InsufficientFundsError if this would cause available < 0 (defensive check)
   * @emits WalletCreditedEvent
   */
  credit(
    amount: Money,
    source: string,
    reference: string,
    errandId: ErrandId | null,
  ): void;

  /**
   * Decreases available balance and creates DEBIT transaction.
   * Must enforce non-negative balance invariant.
   * @param amount Amount to debit in kobo (must be > 0)
   * @param destination Transaction destination (e.g., "withdrawal", "escrow_hold")
   * @param reference External reference
   * @param errandId Optional errand ID if debit is errand-related
   * @throws InvalidAmountError when amount <= 0
   * @throws InsufficientFundsError when available balance < amount
   * @emits WalletDebitedEvent
   */
  debit(
    amount: Money,
    destination: string,
    reference: string,
    errandId: ErrandId | null,
  ): void;

  /**
   * Moves funds from available to held (for escrow).
   * Creates ESCROW_HOLD transaction. Held funds cannot be withdrawn.
   * @param amount Amount to hold in kobo (must be > 0)
   * @param reference External reference (typically escrow ID)
   * @param errandId Errand ID this hold is for
   * @throws InvalidAmountError when amount <= 0
   * @throws InsufficientFundsError when available balance < amount
   * @emits FundsHeldEvent
   */
  hold(amount: Money, reference: string, errandId: ErrandId): void;

  /**
   * Moves funds from held back to available (escrow cancelled/refunded).
   * Creates ESCROW_RELEASE transaction.
   * @param amount Amount to release in kobo (must be > 0)
   * @param reference External reference (typically escrow ID)
   * @param errandId Errand ID this release is for
   * @throws InvalidAmountError when amount <= 0
   * @throws InsufficientFundsError when held balance < amount
   * @emits FundsReleasedEvent
   */
  releaseHold(amount: Money, reference: string, errandId: ErrandId): void;

  /**
   * Transfers held funds to another wallet (escrow payout to worker).
   * Decreases this wallet's held balance and creates ESCROW_PAYOUT transaction.
   * The recipient wallet.credit() must be called separately.
   * @param amount Amount to transfer in kobo (must be > 0)
   * @param reference External reference (typically escrow ID)
   * @param errandId Errand ID this payout is for
   * @throws InvalidAmountError when amount <= 0
   * @throws InsufficientFundsError when held balance < amount
   * @emits FundsTransferredEvent
   */
  transferHeld(amount: Money, reference: string, errandId: ErrandId): void;

  /**
   * Returns current available balance (queryable).
   */
  getAvailableBalance(): Money;

  /**
   * Returns current held balance (queryable).
   */
  getHeldBalance(): Money;

  /**
   * Returns total balance (available + held).
   */
  getTotalBalance(): Money;

  /**
   * Validates wallet integrity by ensuring available + held equals sum of all transactions.
   * Should be called periodically by background audit job.
   * @throws WalletIntegrityError when balance doesn't match ledger
   */
  validateIntegrity(): void;
}

/**
 * Immutable ledger entry recording a balance change.
 * Child entity of Wallet aggregate. Cannot be modified after creation.
 */
class Transaction {
  /**
   * @param id Unique transaction identifier (from schema: id String @id)
   * @param walletId Parent wallet ID (from schema: walletId String)
   * @param type Transaction type enum (from schema: type TransactionType)
   * @param amount Amount in kobo (from schema: amount Int)
   * @param reference External reference (from schema: reference String @unique)
   * @param status Transaction status (from schema: status TransactionStatus)
   * @param errandId Optional errand ID (from schema: errandId String?)
   * @param ownerId Owner ID (from schema: ownerId String)
   * @param ownerType Owner type (from schema: ownerType OwnerType)
   * @param createdAt Creation timestamp
   */
  constructor(
    public readonly id: string,
    public readonly walletId: WalletId,
    public readonly type: TransactionType,
    public readonly amount: number,
    public readonly reference: string,
    public readonly status: TransactionStatus,
    public readonly errandId: ErrandId | null,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly ownerType: OwnerType,
    public readonly createdAt: Date,
  );
}

/**
 * Value object representing monetary amount in kobo.
 * Immutable - all operations return new Money instances.
 */
class Money {
  /**
   * @param amountKobo Amount in kobo (1 Naira = 100 kobo)
   * @throws InvalidAmountError when amountKobo < 0
   */
  constructor(public readonly amountKobo: number);

  /**
   * Adds two money values.
   * @param other Money to add
   * @returns New Money instance with sum
   */
  add(other: Money): Money;

  /**
   * Subtracts another money value.
   * @param other Money to subtract
   * @returns New Money instance with difference
   * @throws InvalidAmountError when result would be negative
   */
  subtract(other: Money): Money;

  /**
   * Splits amount into platform fee and net amount.
   * @param feeRateBasisPoints Fee rate as basis points (500 = 5%)
   * @returns Tuple [platformFee, netAmount] where gross = fee + net
   */
  splitFee(feeRateBasisPoints: number): [Money, Money];

  /**
   * Formats as Naira with 2 decimal places (e.g., "₦1,234.56").
   */
  toNairaString(): string;
}

/** Thrown when amount is negative or zero in contexts requiring positive amount. */
class InvalidAmountError extends Error {}

/** Thrown when wallet balance is insufficient for debit/hold/transfer operation. */
class InsufficientFundsError extends Error {}

/** Thrown when wallet integrity check fails (balance doesn't match ledger). */
class WalletIntegrityError extends Error {}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Wallet aggregate.
 * Domain and application layers depend on this interface, not Prisma.
 */
interface IWalletRepository {
  /**
   * Finds wallet by unique ID.
   * @param id Wallet ID
   * @returns Wallet aggregate or null if not found
   */
  findById(id: WalletId): Promise<Wallet | null>;

  /**
   * Finds wallet by owner (user, provider, or client).
   * Each user has exactly one wallet.
   * @param ownerId User/Provider/Client ID
   * @param ownerType Owner type enum
   * @returns Wallet aggregate or null if not found
   */
  findByOwner(
    ownerId: UserId | ProviderId | ClientId,
    ownerType: OwnerType,
  ): Promise<Wallet | null>;

  /**
   * Persists wallet aggregate (insert if new, update if exists).
   * Transactions are append-only - existing transactions are never modified.
   * @param wallet Wallet aggregate with uncommitted transactions
   */
  save(wallet: Wallet): Promise<void>;

  /**
   * Finds all wallets with balance discrepancies (for audit).
   * Used by background integrity check job.
   * @returns Wallets where available + held != sum of transactions
   */
  findWalletsWithDiscrepancies(): Promise<Wallet[]>;
}
```

### Application Layer

```typescript
/**
 * Creates new wallet for user during registration.
 * Wallets are created automatically when Provider or Client profiles are created.
 */
class CreateWalletCommandHandler {
  /**
   * @param command Contains ownerId and ownerType
   * @throws WalletAlreadyExistsError when user already has a wallet
   * @emits WalletCreatedEvent
   */
  execute(command: CreateWalletCommand): Promise<void>;
}

interface CreateWalletCommand {
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
}

/**
 * Credits wallet (top-up, refund, escrow release to worker).
 * Handles both manual top-ups and automatic credits from escrow releases.
 */
class CreditWalletCommandHandler {
  /**
   * @param command Credit details
   * @throws WalletNotFoundError when wallet doesn't exist
   * @throws InvalidAmountError when amount <= 0
   * @emits WalletCreditedEvent
   */
  execute(command: CreditWalletCommand): Promise<void>;
}

interface CreditWalletCommand {
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
  amount: number; // kobo
  source: string;
  reference: string;
  errandId: ErrandId | null;
}

/**
 * Debits wallet (withdrawal, escrow hold).
 * Used when client pays for errand or user requests withdrawal.
 */
class DebitWalletCommandHandler {
  /**
   * @param command Debit details
   * @throws WalletNotFoundError when wallet doesn't exist
   * @throws InsufficientFundsError when balance too low
   * @throws InvalidAmountError when amount <= 0
   * @emits WalletDebitedEvent
   */
  execute(command: DebitWalletCommand): Promise<void>;
}

interface DebitWalletCommand {
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
  amount: number; // kobo
  destination: string;
  reference: string;
  errandId: ErrandId | null;
}

/**
 * Holds funds in wallet for escrow (moves available → held).
 * Called by AcceptApplicationSaga after escrow is funded.
 */
class HoldFundsCommandHandler {
  /**
   * @param command Hold details
   * @throws WalletNotFoundError when wallet doesn't exist
   * @throws InsufficientFundsError when available balance < amount
   * @emits FundsHeldEvent
   */
  execute(command: HoldFundsCommand): Promise<void>;
}

interface HoldFundsCommand {
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
  amount: number; // kobo
  reference: string; // escrow ID
  errandId: ErrandId;
}

/**
 * Releases held funds back to available (escrow cancelled/refunded).
 * Called when errand is cancelled before completion.
 */
class ReleaseHoldCommandHandler {
  /**
   * @param command Release details
   * @throws WalletNotFoundError when wallet doesn't exist
   * @throws InsufficientFundsError when held balance < amount
   * @emits FundsReleasedEvent
   */
  execute(command: ReleaseHoldCommand): Promise<void>;
}

interface ReleaseHoldCommand {
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
  amount: number; // kobo
  reference: string; // escrow ID
  errandId: ErrandId;
}

/**
 * Transfers held funds from client to worker (escrow payout).
 * Called when errand completes and escrow is released.
 * This is a coordinated operation: debit client held + credit worker available.
 */
class TransferHeldFundsCommandHandler {
  /**
   * @param command Transfer details
   * @throws WalletNotFoundError when either wallet doesn't exist
   * @throws InsufficientFundsError when sender held balance < amount
   * @emits FundsTransferredEvent (from sender), WalletCreditedEvent (to recipient)
   */
  execute(command: TransferHeldFundsCommand): Promise<void>;
}

interface TransferHeldFundsCommand {
  fromOwnerId: UserId | ProviderId | ClientId; // client ID
  fromOwnerType: OwnerType; // CLIENT
  toOwnerId: UserId | ProviderId | ClientId; // worker ID
  toOwnerType: OwnerType; // PROVIDER
  amount: number; // kobo
  reference: string; // escrow ID
  errandId: ErrandId;
}

/**
 * Query handler: Get wallet balance and transaction history.
 */
class GetWalletQueryHandler {
  /**
   * @param query Owner identification
   * @returns Wallet details with balance and recent transactions
   * @throws WalletNotFoundError when wallet doesn't exist
   */
  execute(query: GetWalletQuery): Promise<WalletDTO>;
}

interface GetWalletQuery {
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
}

interface WalletDTO {
  id: WalletId;
  ownerId: UserId | ProviderId | ClientId;
  ownerType: OwnerType;
  availableBalance: number; // kobo
  heldBalance: number; // kobo
  totalBalance: number; // kobo
  recentTransactions: TransactionDTO[];
}

interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: number; // kobo
  reference: string;
  status: TransactionStatus;
  errandId: ErrandId | null;
  createdAt: Date;
}
```

### Domain Events

```typescript
/**
 * Emitted when new wallet is created (during user registration).
 * Consumed by: Notification module (welcome message)
 */
class WalletCreatedEvent {
  constructor(
    public readonly walletId: WalletId,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly ownerType: OwnerType,
  ) {}
}

/**
 * Emitted when wallet is credited.
 * Consumed by: Notification module (balance update notification)
 */
class WalletCreditedEvent {
  constructor(
    public readonly walletId: WalletId,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly amount: number, // kobo
    public readonly source: string,
    public readonly reference: string,
    public readonly errandId: ErrandId | null,
  ) {}
}

/**
 * Emitted when wallet is debited.
 * Consumed by: Notification module (balance update notification)
 */
class WalletDebitedEvent {
  constructor(
    public readonly walletId: WalletId,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly amount: number, // kobo
    public readonly destination: string,
    public readonly reference: string,
    public readonly errandId: ErrandId | null,
  ) {}
}

/**
 * Emitted when funds are held for escrow.
 * Consumed by: AcceptApplicationSaga (next step after funding)
 */
class FundsHeldEvent {
  constructor(
    public readonly walletId: WalletId,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly amount: number, // kobo
    public readonly reference: string, // escrow ID
    public readonly errandId: ErrandId,
  ) {}
}

/**
 * Emitted when held funds are released back to available.
 * Consumed by: Notification module (refund notification)
 */
class FundsReleasedEvent {
  constructor(
    public readonly walletId: WalletId,
    public readonly ownerId: UserId | ProviderId | ClientId,
    public readonly amount: number, // kobo
    public readonly reference: string, // escrow ID
    public readonly errandId: ErrandId,
  ) {}
}

/**
 * Emitted when held funds are transferred from one wallet to another.
 * Consumed by: Notification module (payment received notification)
 */
class FundsTransferredEvent {
  constructor(
    public readonly fromWalletId: WalletId,
    public readonly toWalletId: WalletId,
    public readonly amount: number, // kobo
    public readonly reference: string, // escrow ID
    public readonly errandId: ErrandId,
  ) {}
}
```

### Event Handlers (React to other module events)

```typescript
/**
 * Listens to EscrowFundedEvent and holds funds in client wallet.
 * Part of AcceptApplicationSaga workflow.
 */
class OnEscrowFundedHoldFundsHandler {
  /**
   * @listens EscrowFundedEvent
   * Calls HoldFundsCommandHandler to move client's available → held
   */
  handle(event: EscrowFundedEvent): Promise<void>;
}

/**
 * Listens to EscrowReleasedEvent and transfers held funds to worker.
 * Part of CompleteErrandSaga workflow.
 */
class OnEscrowReleasedTransferFundsHandler {
  /**
   * @listens EscrowReleasedEvent
   * Calls TransferHeldFundsCommandHandler to pay worker
   */
  handle(event: EscrowReleasedEvent): Promise<void>;
}

/**
 * Listens to EscrowRefundedEvent and releases held funds back to client.
 * Part of RefundErrandSaga workflow.
 */
class OnEscrowRefundedReleaseFundsHandler {
  /**
   * @listens EscrowRefundedEvent
   * Calls ReleaseHoldCommandHandler to return funds to client
   */
  handle(event: EscrowRefundedEvent): Promise<void>;
}
```
