# Wallet - DDD & EIP Analysis

## 1. Current Responsibility

**Intended to manage user wallet balances through an immutable ledger.** Updated: this module was previously described with mutable stored balance fields (`available`, `held`). The target design is now ledger-only: every balance movement is an append-only `LedgerEntry`, and active, pending, and available balances are computed from ledger entries.

- `WalletService` is a **stub** with placeholder methods returning strings like `'This action adds a new wallet'`.
- `WalletResolver` has CRUD scaffolding but no real implementation.
- Actual wallet logic is **scattered across other modules**:
  - `EscrowService` creates wallet transactions (`this.prisma.transaction.create`, line ~150 in `escrow.service.ts`).
  - `PaymentGatewayService` updates wallet balance during refund fallback (`this.prisma.wallet.update`, line ~150 in `payment-gateway.service.ts`).
  - No centralized service for wallet operations.

**Files**: `wallet.service.ts` (stub), `wallet.resolver.ts` (stub), `wallet.module.ts`.

## 2. Bounded Context Assessment

**This SHOULD be a real bounded context** for "Wallet & Ledger Management", but it is currently **degenerate** - the domain logic lives elsewhere.

**Overlaps**:

- **Escrow**: Escrow lifecycle should produce wallet ledger entries for worker active balance, worker pending balance, worker available balance, active reversal, and client refunds.
- **Payment-Gateway**: Paystack charges/refunds are the ground truth for external money movement; wallet entries must be traceable to gateway references when they represent an external payment event.
- **Errands** (indirectly): Errand completion triggers worker balance movement from active to pending.
- **Dispute** (future): Dispute resolution will eventually own refunding escrows already in `COMPLETED_PENDING_PAYOUT`; this is explicitly deferred.

**Verdict**: Wallet is a missing bounded context - the domain exists in the Prisma schema (`Wallet`, `Transaction` models), but the target design requires replacing the mutable balance model with a ledger-only aggregate and a `LedgerEntry` model.

## 3. Domain Model Audit

Updated: the prior audit assumed `Wallet.available` and `Wallet.held` were authoritative balance fields. They are now deprecated implementation details and must not be used as source-of-truth balances.

**Anemic models**:

- `Wallet` (Prisma model): currently has `available`, `held`, and `currency`, but no behavior. In the target model, `available` and `held` are removed/deprecated; a wallet has identity and ownership only.
- `Transaction` (Prisma model): currently acts as a partial ledger with `ownerId`, `ownerType`, `errandId`, `amount`, `type`, `status`, and `reference`, but the target model is a new immutable `LedgerEntry` with `walletId`, `escrowId`, `gatewayReference`, and the explicit ledger entry types needed for the three-bucket worker model.

**Aggregate boundaries**:

- **`Wallet`** should be the aggregate root with no stored balance fields.
- **`LedgerEntry`** is append-only and immutable. It records each balance movement and is never updated after creation.
- Worker balances are three separate computed buckets:
  - Active errand balance: escrow-funded work in progress; visible, not withdrawable.
  - Pending balance: completed work inside the 3-day clearance window; visible, not withdrawable.
  - Available balance: cleared funds; visible and withdrawable.
- Normal worker flow is one-way: `ACTIVE_ERRAND_CREDIT` -> `PENDING_CREDIT` -> `AVAILABLE_CREDIT`.
- Clients do not have wallet-tracked escrow holds. Client spending is computed from `Escrow` records, not from wallet balances. Clients only receive wallet credits via refunds.

**Invariants currently unenforced**:

1. **Ledger-only balance integrity**:
   - Current code mutates `Wallet.available` directly. Target behavior computes active, pending, and available balances by summing `LedgerEntry` rows.
   - Balance snapshots may exist only as read-model/materialized-view optimization, never as source of truth.
2. **Bucket movement rules**:
   - Active balance can move to pending only when escrow reaches completed pending payout.
   - Pending balance can move to available only after the 3-day clearance window elapses.
   - Pending/available funds do not move back to active under normal operation.
3. **Client wallet scope**:
   - Client escrow spending must not appear as a wallet hold or debit. `amount spent` belongs to an Escrow read model.
   - Client wallet entries are refund credits only, unless future top-up/withdrawal product requirements are introduced.
4. **Refund gap**:
   - Refunds from `COMPLETED_PENDING_PAYOUT` would reverse a pending-balance credit and are out of scope until the Dispute module exists.
5. **Gateway reconciliation**:
   - Every ledger entry caused by a Paystack charge/refund must carry the Paystack reference that caused it so duplicate webhooks can be ignored and reconciliation can compare ledger state to Paystack records.

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

  Updated: this must become a Wallet command that appends `LedgerEntry` rows. Escrow should not know wallet schema details.

- Payment-gateway module updates wallet balance:
  ```typescript
  await this.prisma.wallet.update({
    where: { id: wallet.id },
    data: { available: { increment: refundAmountKobo } },
  });
  ```
  Updated: this must become a `RecordClientRefundCommandHandler` call that appends a `REFUND_CREDIT` ledger entry with the Paystack refund reference.

**Persistence leaking**:

- Other modules directly call `this.prisma.wallet.*` and `this.prisma.transaction.*` - bypassing any wallet service.

## 5. Repository Pattern Gap

**Current state**: No repository. Wallet data is accessed directly via Prisma from Escrow and Payment-Gateway modules.

**Proposed**:

```
domain/
  IWalletRepository
  ILedgerEntryRepository
infrastructure/
  PrismaWalletRepository
  PrismaLedgerEntryRepository
```

**Consolidation**: All `prisma.wallet.*` and `prisma.transaction.*` calls in Escrow and Payment-Gateway modules are replaced with wallet command handlers that append ledger entries and publish wallet domain events.

## 6. EIP Opportunities

Updated: the ledger itself is now the central integration pattern.

1. **Event Sourcing / Append-Only Log**:
   - The wallet ledger is the authoritative fact stream for balance movements.
   - Wallet balances are projections of the ledger, not mutable fields.
2. **Materialized View**:
   - Active, pending, and available balance snapshots can be maintained for read-heavy queries.
   - Snapshots are rebuildable from the ledger and must not be treated as authoritative.
3. **Idempotent Receiver**:
   - Gateway webhook-driven operations must use `gatewayReference` plus `type`/`walletId` uniqueness to prevent duplicate ledger entries.
4. **Reconciliation / Audit**:
   - A scheduled job compares ledger entries with Paystack transaction/refund records by gateway reference.
5. **Dead Letter Channel / Retry**:
   - Wallet entry posting after a successful external payment event must be queued, retried, and dead-lettered with alerting if persistence repeatedly fails.

## 7. Cross-Cutting Concerns

**Validation**:

- Amount validation is missing. Ledger entries must reject `amountKobo <= 0`.
- Wallet operations must check computed balances before creating reversal, pending release, available release, and withdrawal entries.

**Transactions**:

- Wallet updates are currently done inside transactions started by other modules.
- Target behavior: Wallet owns appending ledger entries. Cross-module workflows use events/sagas and idempotent command handlers.

**Error handling**:

- Current code lacks domain errors for insufficient active, pending, and available balances.
- Target behavior: domain errors are explicit, typed, and separate from infrastructure failures.

## 8. GraphQL-Specific Notes

**No real GraphQL exposure**:

- `WalletResolver` exists but is a stub.

**Should there be a resolver?**

- Yes, for queries such as:
  - `myWalletBalances` -> returns active, pending, and available balances.
  - `myLedgerHistory(pagination)` -> ledger query.
  - `withdrawFunds(amount)` -> mutation to request withdrawal against available balance.

**Authorization**:

- Users can only query/mutate their own wallet.
- Admin/audit access must be separately authorized and logged.

## 9. Target Structure

```
src/wallet/
  domain/
    entities/
      Wallet.ts
      LedgerEntry.ts
    value-objects/
      WalletId.ts
      LedgerEntryId.ts
      LedgerEntryType.ts
    repositories/
      IWalletRepository.ts
      ILedgerEntryRepository.ts
    events/
      ActiveErrandCredited.ts
      MovedToPending.ts
      ReleasedToAvailable.ts
      WithdrawalRecorded.ts
      ActiveErrandReversed.ts
      ClientRefunded.ts
    errors/
      InsufficientActiveBalanceError.ts
      InsufficientPendingBalanceError.ts
      InsufficientAvailableBalanceError.ts
      InvalidLedgerAmountError.ts
      UnsupportedPendingRefundError.ts

  application/
    commands/
      CreditActiveErrand/
      MoveActiveToPending/
      ReleaseToAvailable/
      RecordWithdrawal/
      ReverseActiveErrand/
      RecordClientRefund/
    queries/
      GetWalletBalances/
      GetLedgerHistory/
    jobs/
      RebuildWalletBalanceSnapshotJob.ts
      ReconcileLedgerWithPaystackJob.ts

  infrastructure/
    repositories/
      PrismaWalletRepository.ts
      PrismaLedgerEntryRepository.ts

  presentation/
    resolvers/
      WalletResolver.ts
```

## Persistence Model (Derived from Domain)

```prisma
model Wallet {
  id String @id @map("_id")
  userId String
  currency String?
  createdAt DateTime
  updatedAt DateTime

  @@unique([userId]) // backs: WalletAlreadyExistsError
}

model LedgerEntry {
  id String @id @map("_id")
  walletId String
  userId String
  type LedgerEntryType
  amountKobo Int
  currency String
  escrowId String?
  gatewayReference String?
  idempotencyKey String
  metadata Json?
  createdAt DateTime

  @@index([walletId, createdAt]) // serves: findByWalletId
  @@index([escrowId]) // serves: findByEscrowId
  @@index([gatewayReference]) // serves: findByGatewayReference
  @@unique([idempotencyKey]) // backs: DuplicateLedgerEntryError
}
```

`Wallet` is the aggregate root; `LedgerEntry` has its own append-only lifecycle but is reachable only through `IWalletRepository`/`ILedgerEntryRepository`. References are scalar IDs: `userId`, `walletId`, `escrowId`. Cleanup owners: `UserDeletedPolicyHandler` must soft-delete users with wallet history; `WalletDeletionPolicyHandler` prevents wallet deletion when ledger entries exist; `EscrowDeletedPolicyHandler` prevents deletion of escrow records referenced by ledger entries. `id` serves `findById` implicitly where needed, `userId` serves `findByUserId`, and all ledger indexes map 1:1 to ledger repository methods. `idempotencyKey` is generated by the application command from wallet/type/escrow/gateway context and backs webhook/command idempotency without relying on nullable compound unique fields.

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Strongly typed wallet identifier backed by the shared EntityId base.
 * The EntityId constructor rejects empty or whitespace-only values, so WalletId.from()
 * cannot rehydrate an invalid persisted ID.
 */
class WalletId extends EntityId {
  /**
   * Creates a new wallet identifier.
   */
  static new(): WalletId;

  /**
   * Rehydrates a wallet identifier from the persisted Prisma Wallet.id field.
   */
  static from(value: string): WalletId;
}

/**
 * Strongly typed ledger entry identifier backed by the shared EntityId base.
 * The EntityId constructor rejects empty or whitespace-only values, so LedgerEntryId.from()
 * cannot rehydrate an invalid persisted ID.
 */
class LedgerEntryId extends EntityId {
  /**
   * Creates a new ledger entry identifier.
   */
  static new(): LedgerEntryId;

  /**
   * Rehydrates a ledger entry identifier from the persisted Prisma LedgerEntry.id field.
   */
  static from(value: string): LedgerEntryId;
}

/**
 * Immutable ledger entry categories for the wallet three-bucket model.
 * Worker money moves one way in normal operation: active errand balance to pending balance
 * to available balance. Clients do not receive escrow holds in wallet; their wallet credits
 * are refunds only. Reversals are represented by explicit entries rather than mutation.
 */
enum LedgerEntryType {
  ACTIVE_ERRAND_CREDIT = 'ACTIVE_ERRAND_CREDIT',
  ACTIVE_ERRAND_REVERSAL = 'ACTIVE_ERRAND_REVERSAL',
  PENDING_CREDIT = 'PENDING_CREDIT',
  AVAILABLE_CREDIT = 'AVAILABLE_CREDIT',
  WITHDRAWAL_DEBIT = 'WITHDRAWAL_DEBIT',
  REFUND_CREDIT = 'REFUND_CREDIT',
}

/**
 * Immutable append-only wallet ledger entry.
 * This is not an aggregate root: Wallet is the aggregate root, and LedgerEntry is the
 * child entity/log record produced by Wallet behavior and persisted append-only.
 * Maps to the proposed Prisma LedgerEntry model fields:
 * id, walletId, userId, type, amountKobo, currency, escrowId, gatewayReference,
 * metadata, createdAt.
 */
class LedgerEntry {
  /**
   * Private constructor. Use LedgerEntry.create() so amount validation and audit fields
   * are consistently enforced before persistence.
   */
  private constructor(
    public readonly id: LedgerEntryId,
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly type: LedgerEntryType,
    public readonly amountKobo: number,
    public readonly currency: string,
    public readonly escrowId: EscrowId | null,
    public readonly gatewayReference: string | null,
    public readonly metadata: Record<string, unknown> | null,
    public readonly createdAt: Date,
  );

  /**
   * Creates a new immutable ledger entry and rejects zero or negative amounts.
   * Entries tied to Paystack charge/refund events must include gatewayReference so the
   * ledger can be reconciled against Paystack and duplicate webhooks can be ignored.
   */
  static create(params: CreateLedgerEntryParams): LedgerEntry;
}

/**
 * Parameters used to create a LedgerEntry.
 */
interface CreateLedgerEntryParams {
  walletId: WalletId;
  userId: UserId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: string;
  escrowId: EscrowId | null;
  gatewayReference: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Wallet aggregate root. It owns no stored balance fields; active, pending, and available
 * balances are computed from LedgerEntry rows supplied by ILedgerEntryRepository or a
 * trusted materialized read model rebuilt from those rows.
 */
class Wallet extends AggregateRoot<WalletId> {
  /**
   * Private constructor. Use Wallet.create() for brand-new wallets and Wallet.reconstitute()
   * for records loaded from the Prisma Wallet model.
   */
  private constructor(
    public readonly id: WalletId,
    public readonly userId: UserId,
    public readonly currency: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Creates a brand-new wallet with no stored balance. The wallet starts at zero because
   * no LedgerEntry rows exist yet.
   */
  static create(userId: UserId, currency: string | null): Wallet;

  /**
   * Reconstitutes a wallet from persistence. Loading a wallet does not load a mutable
   * balance column; any balance check must be supplied by computed ledger totals.
   */
  static reconstitute(
    id: WalletId,
    userId: UserId,
    currency: string | null,
    createdAt: Date,
    updatedAt: Date,
  ): Wallet;

  /**
   * Records worker active errand balance when an escrow is funded and work is in progress.
   * Produces ACTIVE_ERRAND_CREDIT. Depends on idempotency checks by escrowId/gatewayReference
   * to prevent duplicate credits for the same Paystack-funded escrow.
   */
  recordActiveErrandCredit(
    amountKobo: number,
    currency: string,
    escrowId: EscrowId,
    gatewayReference: string,
  ): LedgerEntry;

  /**
   * Moves worker funds from active errand balance to pending balance after completion.
   * Produces ACTIVE_ERRAND_REVERSAL and PENDING_CREDIT. Requires computed active balance
   * for this wallet/escrow to be greater than or equal to amount before entries are produced.
   */
  moveActiveToPending(
    amountKobo: number,
    currency: string,
    escrowId: EscrowId,
    computedActiveBalanceKobo: number,
  ): LedgerEntry[];

  /**
   * Releases worker funds from pending balance to available balance after the 3-day
   * clearance window elapses. Produces AVAILABLE_CREDIT. Requires computed pending balance
   * for this wallet/escrow to be greater than or equal to amount before the entry is produced.
   */
  moveToAvailable(
    amountKobo: number,
    currency: string,
    escrowId: EscrowId,
    computedPendingBalanceKobo: number,
  ): LedgerEntry;

  /**
   * Records a withdrawal from available balance. Produces WITHDRAWAL_DEBIT. Requires
   * computed available balance to be greater than or equal to amount before the entry is
   * produced.
   */
  recordWithdrawal(
    amountKobo: number,
    currency: string,
    gatewayReference: string,
    computedAvailableBalanceKobo: number,
  ): LedgerEntry;

  /**
   * Reverses worker active errand balance before completion, typically when an escrow is
   * cancelled/refunded before work completes. Produces ACTIVE_ERRAND_REVERSAL. Requires
   * computed active balance for this wallet/escrow to be greater than or equal to amount.
   */
  recordActiveErrandReversal(
    amountKobo: number,
    currency: string,
    escrowId: EscrowId,
    gatewayReference: string,
    computedActiveBalanceKobo: number,
  ): LedgerEntry;

  /**
   * Records a client-side refund credit. Produces REFUND_CREDIT. Clients do not have
   * wallet-tracked escrow holds, so this is the only client escrow-related wallet credit.
   */
  recordClientRefund(
    amountKobo: number,
    currency: string,
    escrowId: EscrowId,
    gatewayReference: string,
  ): LedgerEntry;
}

/**
 * Thrown when a ledger entry amount is zero or negative.
 */
class InvalidLedgerAmountError extends Error {}

/**
 * Thrown when an active-balance reversal or active-to-pending move exceeds the computed
 * active errand balance.
 */
class InsufficientActiveBalanceError extends Error {}

/**
 * Thrown when pending-to-available release exceeds the computed pending balance.
 */
class InsufficientPendingBalanceError extends Error {}

/**
 * Thrown when withdrawal exceeds computed available balance.
 */
class InsufficientAvailableBalanceError extends Error {}

/**
 * Thrown when code attempts to refund an escrow already in COMPLETED_PENDING_PAYOUT.
 * This path is intentionally deferred because it needs Dispute module rules to decide
 * whether pending worker credit is reversed, partially reversed, or paid out.
 */
class UnsupportedPendingRefundError extends Error {}
```

### Repository Interface

```typescript
/**
 * Persistence contract for immutable ledger entries.
 */
interface ILedgerEntryRepository {
  /**
   * Appends one ledger entry atomically. Implementations must not update existing entries.
   */
  append(entry: LedgerEntry): Promise<void>;

  /**
   * Appends multiple ledger entries atomically for one wallet operation, such as
   * active-to-pending movement.
   */
  appendMany(entries: LedgerEntry[]): Promise<void>;

  /**
   * Finds entries for a wallet so application/query handlers can compute active, pending,
   * and available balances from the append-only log.
   */
  findByWalletId(walletId: WalletId): Promise<LedgerEntry[]>;

  /**
   * Finds entries related to an escrow for audit, dispute preparation, and reconciliation.
   */
  findByEscrowId(escrowId: EscrowId): Promise<LedgerEntry[]>;

  /**
   * Finds entries with a Paystack gateway reference for webhook idempotency and external
   * reconciliation.
   */
  findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>;
}

/**
 * Persistence contract for Wallet aggregate identity and ownership only.
 */
interface IWalletRepository {
  /**
   * Finds a wallet by user ID. Loading a Wallet means loading identity, then reconstructing
   * computed balances from ILedgerEntryRepository or a ledger-backed materialized view.
   */
  findByUserId(userId: UserId): Promise<Wallet | null>;

  /**
   * Saves wallet identity/ownership data. This does not persist balance fields.
   * EIP Aggregator note: Wallet is the aggregate boundary that coordinates ledger entry
   * creation, while the ledger is the child log used to compute aggregate state.
   */
  save(wallet: Wallet): Promise<void>;
}
```

### Application Layer (Command/Query Handlers)

```typescript
/**
 * Called when Escrow funding succeeds and the worker has funds committed to in-progress
 * work. Produces ACTIVE_ERRAND_CREDIT.
 */
class CreditActiveErrandCommandHandler {
  /**
   * Executes the active errand credit use case.
   */
  execute(command: CreditActiveErrandCommand): Promise<void>;
}

/**
 * Input for CreditActiveErrandCommandHandler.
 */
interface CreditActiveErrandCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: string;
  gatewayReference: string;
}

/**
 * Called by MarkEscrowCompletedHandler when an escrow transitions to
 * COMPLETED_PENDING_PAYOUT. Produces ACTIVE_ERRAND_REVERSAL and PENDING_CREDIT.
 */
class MoveActiveToPendingCommandHandler {
  /**
   * Executes active-to-pending movement after verifying computed active balance.
   */
  execute(command: MoveActiveToPendingCommand): Promise<void>;
}

/**
 * Input for MoveActiveToPendingCommandHandler.
 */
interface MoveActiveToPendingCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: string;
}

/**
 * Called by the clearance job after the 3-day window elapses. Produces AVAILABLE_CREDIT.
 */
class ReleaseToAvailableCommandHandler {
  /**
   * Executes pending-to-available release after verifying computed pending balance.
   */
  execute(command: ReleaseToAvailableCommand): Promise<void>;
}

/**
 * Input for ReleaseToAvailableCommandHandler.
 */
interface ReleaseToAvailableCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: string;
}

/**
 * Called by withdrawal flow after withdrawal request validation. Produces WITHDRAWAL_DEBIT.
 */
class RecordWithdrawalCommandHandler {
  /**
   * Executes withdrawal recording after verifying computed available balance.
   */
  execute(command: RecordWithdrawalCommand): Promise<void>;
}

/**
 * Input for RecordWithdrawalCommandHandler.
 */
interface RecordWithdrawalCommand {
  userId: UserId;
  amountKobo: number;
  currency: string;
  gatewayReference: string;
}

/**
 * Called when an active escrow is refunded/cancelled before completion. Produces
 * ACTIVE_ERRAND_REVERSAL.
 */
class ReverseActiveErrandCommandHandler {
  /**
   * Executes active errand reversal after verifying computed active balance.
   */
  execute(command: ReverseActiveErrandCommand): Promise<void>;
}

/**
 * Input for ReverseActiveErrandCommandHandler.
 */
interface ReverseActiveErrandCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: string;
  gatewayReference: string;
}

/**
 * Called when Paystack refund succeeds for a client. Produces REFUND_CREDIT. Does not
 * create or reverse a client escrow hold because clients have no wallet-tracked holds.
 */
class RecordClientRefundCommandHandler {
  /**
   * Executes client refund credit recording.
   */
  execute(command: RecordClientRefundCommand): Promise<void>;
}

/**
 * Input for RecordClientRefundCommandHandler.
 */
interface RecordClientRefundCommand {
  clientUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: string;
  gatewayReference: string;
}

/**
 * Query handler for current wallet balances. This is where entry summation happens.
 * Advanced EIP Opportunity: maintain a materialized balance snapshot updated on each
 * appended ledger entry, and rebuild it from the ledger if the snapshot is suspected stale.
 */
class GetWalletBalancesQueryHandler {
  /**
   * Returns active, pending, and available balances computed from the ledger or from a
   * ledger-backed materialized view.
   */
  execute(query: GetWalletBalancesQuery): Promise<WalletBalancesDTO>;
}

/**
 * Input for GetWalletBalancesQueryHandler.
 */
interface GetWalletBalancesQuery {
  userId: UserId;
}

/**
 * Balance DTO returned by the wallet query side.
 */
interface WalletBalancesDTO {
  activeKobo: number;
  pendingKobo: number;
  availableKobo: number;
  currency: string;
}

/**
 * Query handler for paginated wallet transaction history display.
 */
class GetLedgerHistoryQueryHandler {
  /**
   * Returns paginated ledger entries for the wallet owner.
   */
  execute(query: GetLedgerHistoryQuery): Promise<LedgerHistoryPageDTO>;
}

/**
 * Input for GetLedgerHistoryQueryHandler.
 */
interface GetLedgerHistoryQuery {
  userId: UserId;
  cursor: string | null;
  limit: number;
}

/**
 * Paginated ledger history DTO.
 */
interface LedgerHistoryPageDTO {
  entries: LedgerEntryDTO[];
  nextCursor: string | null;
}

/**
 * User-facing ledger entry DTO.
 */
interface LedgerEntryDTO {
  id: LedgerEntryId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: string;
  escrowId: EscrowId | null;
  createdAt: Date;
}
```

### Domain Events

```typescript
/**
 * Emitted when worker active errand balance is credited. Consumed by notification module
 * and audit logging.
 */
class ActiveErrandCredited {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  );
}

/**
 * Emitted when active errand balance moves to pending. Consumed by notification module
 * and audit logging.
 */
class MovedToPending {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  );
}

/**
 * Emitted when pending balance clears to available. Consumed by notification module and
 * audit logging.
 */
class ReleasedToAvailable {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  );
}

/**
 * Emitted when available balance is debited for withdrawal. Consumed by notification
 * module and audit logging.
 */
class WithdrawalRecorded {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly amountKobo: number,
    public readonly gatewayReference: string,
  );
}

/**
 * Emitted when active errand balance is reversed. Consumed by notification module and
 * audit logging.
 */
class ActiveErrandReversed {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  );
}

/**
 * Emitted when a client receives a refund credit. Consumed by notification module and
 * audit logging.
 */
class ClientRefunded {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
    public readonly gatewayReference: string,
  );
}
```

## EIP Patterns Applied

- **Event Sourcing / Append-Only Log**: `LedgerEntry` is the authoritative wallet record. Balances are projections of entries, so audit can replay the ledger instead of trusting mutable columns.
- **Materialized View**: `WalletBalancesDTO` can be served from a `WalletBalanceSnapshot` read model updated on each new entry. If stale, rebuild from `LedgerEntry`.
- **Idempotent Receiver**: Paystack webhooks can fire more than once. `gatewayReference` plus uniqueness constraints prevent duplicate ledger rows for the same external payment event.
- **Reconciliation / Audit pattern**: A scheduled job compares Paystack charge/refund records to ledger entries by `gatewayReference` and reports missing, duplicate, or amount-mismatched entries.
- **Dead Letter Channel**: If an external payment succeeds but the wallet ledger append fails, the operation is retried through the existing BullMQ queue infrastructure. After retries are exhausted, the job moves to a DLQ with enough payload to append the missing `LedgerEntry`; it must never be silently dropped.
