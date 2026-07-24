# Wallet - DDD & EIP Analysis

## Current Responsibility

Wallet owns money movements after external payment outcomes are known. Balances are derived from append-only `LedgerEntry` records; active, pending, and available amounts are projections rather than mutable source-of-truth fields.

## Bounded Context Assessment

Wallet is a distinct bounded context because it owns append-only ledger, idempotent money movement, and materialized balance snapshot. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Wallet` as the aggregate root and `WalletId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IWalletRepository / ILedgerEntryRepository / IWalletBalanceSnapshotRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Wallet` is the aggregate root and `WalletId` is the strongly typed aggregate identifier. `LedgerEntry` is the append-only money movement record and `WalletBalanceSnapshot` is the materialized read model. Escrow-related movements key idempotency by `escrowId`; withdrawals key idempotency by `gatewayReference` because they are not tied to an escrow.

Domain events are queued inside `Wallet` with `addDomainEvent()`. Application handlers append ledger entries first, update the balance snapshot after the append succeeds, then publish `wallet.pullDomainEvents()` through `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Wallet {
  id String @id @map("_id")
  userId String
  currency String
  createdAt DateTime
  updatedAt DateTime

  @@unique([userId])
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

  @@unique([idempotencyKey])
  @@index([walletId, createdAt])
  @@index([gatewayReference])
}

model WalletBalanceSnapshot {
  id String @id @map("_id")
  walletId String
  activeKobo Int
  pendingKobo Int
  availableKobo Int
  currency String
  rebuiltAt DateTime
  updatedAt DateTime

  @@unique([walletId])
}
```

Scalar-ID references and cleanup owners:
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler preserves wallet and ledger history for audit instead of hard-deleting money records.
- `escrowId` references Escrow. Cleanup owner: EscrowDeletedPolicyHandler prevents hard deletion while ledger entries reference the escrow.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([userId])` maps to `findByUserId`; domain error: `WalletAlreadyExistsError`.
- `LedgerEntry @@unique([idempotencyKey])` maps to `append / appendMany`; domain error: `DuplicateLedgerEntryError`.
- `LedgerEntry @@index([walletId, createdAt])` maps to `findByWalletId`; domain error: `none`.
- `LedgerEntry @@index([gatewayReference])` maps to `findByGatewayReference / ReconcileLedgerProcessor`; domain error: `none`.
- `WalletBalanceSnapshot @@unique([walletId])` maps to `findByWalletId / apply / rebuild`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


## Target Structure

```text
src/wallet/
  domain/
    entities/
      Wallet.ts
      LedgerEntry.ts
      WalletBalanceSnapshot.ts
    value-objects/
      WalletId.ts
      LedgerEntryId.ts
      LedgerEntryType.ts
      CreateLedgerEntryParams.ts
    errors/
      InsufficientActiveBalanceError.ts
      InsufficientPendingBalanceError.ts
      InsufficientAvailableBalanceError.ts
      InvalidLedgerAmountError.ts
      UnsupportedPendingRefundError.ts
      DuplicateLedgerEntryError.ts
      WalletNotFoundError.ts
    events/
      ActiveErrandCredited.ts
      MovedToPending.ts
      ReleasedToAvailable.ts
      WithdrawalRecorded.ts
      ActiveErrandReversed.ts
      ClientRefunded.ts
      LedgerDiscrepancyDetected.ts
    repositories/
      IWalletRepository.ts
      ILedgerEntryRepository.ts
      IWalletBalanceSnapshotRepository.ts
    services/
      LedgerBalanceCalculator.ts
  application/
    commands/
      CreditActiveErrand/
        CreditActiveErrandCommand.ts
        CreditActiveErrandHandler.ts
      MoveActiveToPending/
        MoveActiveToPendingCommand.ts
        MoveActiveToPendingHandler.ts
      ReleaseToAvailable/
        ReleaseToAvailableCommand.ts
        ReleaseToAvailableHandler.ts
      RecordWithdrawal/
        RecordWithdrawalCommand.ts
        RecordWithdrawalHandler.ts
      ReverseActiveErrand/
        ReverseActiveErrandCommand.ts
        ReverseActiveErrandHandler.ts
      RecordClientRefund/
        RecordClientRefundCommand.ts
        RecordClientRefundHandler.ts
      AppendFailedLedgerEntry/
        AppendFailedLedgerEntryCommand.ts
        AppendFailedLedgerEntryHandler.ts
    queries/
      GetWalletBalances/
        GetWalletBalancesQuery.ts
        GetWalletBalancesHandler.ts
      GetLedgerHistory/
        GetLedgerHistoryQuery.ts
        GetLedgerHistoryHandler.ts
    sagas/
      (none)
    event-handlers/
      (none)
    jobs/
      ReconcileLedgerJob.ts
      ReconcileLedgerProcessor.ts
      AppendFailedLedgerEntryJob.ts
      AppendFailedLedgerEntryProcessor.ts
  infrastructure/
    repositories/
      PrismaWalletRepository.ts
      PrismaLedgerEntryRepository.ts
      PrismaWalletBalanceSnapshotRepository.ts
    mappers/
      WalletMapper.ts
      LedgerEntryMapper.ts
      WalletBalanceSnapshotMapper.ts
    adapters/
      PaystackLedgerAuditAdapter.ts
  presentation/
    resolvers/
      WalletResolver.ts
    graphql/
      wallet-balances.type.ts
      ledger-entry.type.ts
      ledger-history-page.type.ts
      mappers/
        toWalletBalancesType.ts
        toLedgerEntryGraphQLType.ts
        toLedgerHistoryPageType.ts
```

## Implementation Spec

### Domain Layer

```typescript
/**
 * Aggregate root for wallet ownership and ledger-producing behaviors.
 * Constructor fields:
 * - `id: WalletId` identifies the wallet aggregate.
 * - `userId: UserId` identifies the wallet owner.
 * - `currency: Currency` constrains every LedgerEntry created by the wallet.
 * - `createdAt: Date` records creation time from persistence or factory.
 * - `updatedAt: Date` records the last metadata update time.
 */
class Wallet extends AggregateRoot<WalletId> {
  /**
   * Creates a wallet for a user and currency.
   * 1. Validate `userId` is present.
   * 2. Validate `currency` is present.
   * 3. Create `now = new Date()` for `createdAt` and `updatedAt`.
   * 4. Create a new `WalletId` for the aggregate identifier.
   * 5. Return `new Wallet(id, userId, currency, now, now)` without touching repositories.
   * @throws Error when `userId` or `currency` is missing.
   */
  static create(userId: UserId, currency: Currency): Wallet;

  /**
   * Rehydrates persisted wallet state without recording events.
   * 1. Receive persisted `id`, `userId`, `currency`, `createdAt`, and `updatedAt`.
   * 2. Pass those values directly to the Wallet constructor.
   * 3. Do not call `addDomainEvent()` because rehydration is not a business transition.
   * 4. Return the aggregate for command/query use.
   */
  static reconstitute(id: WalletId, userId: UserId, currency: Currency, createdAt: Date, updatedAt: Date): Wallet;

  /**
   * Records worker active balance for a funded errand.
   * 1. Build `idempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_CREDIT}_${escrowId.toString()}``.
   * 2. Call `LedgerEntry.create({ walletId: this.id, userId: this.userId, type: ACTIVE_ERRAND_CREDIT, amountKobo, currency, escrowId, gatewayReference, idempotencyKey })`.
   * 3. Let `LedgerEntry.create()` validate positive amount and required fields.
   * 4. Queue `new ActiveErrandCredited(this.id, this.userId, escrowId, amountKobo)` with `this.addDomainEvent()`.
   * 5. Return the created LedgerEntry for the handler to append.
   */
  recordActiveErrandCredit(amountKobo: number, currency: Currency, escrowId: EscrowId, gatewayReference: string): LedgerEntry;

  /**
   * Moves active errand balance into pending clearance.
   * 1. Compare `computedActiveBalanceKobo` with `amountKobo`.
   * 2. If active balance is too low, throw `InsufficientActiveBalanceError`.
   * 3. Build reversal idempotency key `ACTIVE_ERRAND_REVERSAL_<escrowId>`.
   * 4. Build credit idempotency key `PENDING_CREDIT_<escrowId>`.
   * 5. Create the reversal and pending credit entries with `LedgerEntry.create(...)`.
   * 6. Queue `MovedToPending` with `this.addDomainEvent()`.
   * 7. Return `[debitEntry, creditEntry]` for atomic append.
   */
  moveActiveToPending(amountKobo: number, currency: Currency, escrowId: EscrowId, computedActiveBalanceKobo: number): LedgerEntry[];

  /**
   * Moves pending clearance balance into available balance after the clearance window matures.
   * 1. Compare `computedPendingBalanceKobo` with `amountKobo`.
   * 2. If pending balance is too low, throw `InsufficientPendingBalanceError`.
   * 3. Build idempotency keys `PENDING_REVERSAL_<escrowId>` and `AVAILABLE_CREDIT_<escrowId>`.
   * 4. Create both ledger entries with `LedgerEntry.create(...)`.
   * 5. Queue `ReleasedToAvailable` with `this.addDomainEvent()`.
   * 6. Return `[debitEntry, creditEntry]` for atomic append.
   */
  moveToAvailable(amountKobo: number, currency: Currency, escrowId: EscrowId, computedPendingBalanceKobo: number): LedgerEntry[];

  /**
   * Records an external withdrawal keyed by gateway reference.
   * 1. Compare `computedAvailableBalanceKobo` with `amountKobo`.
   * 2. If available balance is too low, throw `InsufficientAvailableBalanceError`.
   * 3. Build `idempotencyKey = `${LedgerEntryType.WITHDRAWAL_DEBIT}_${gatewayReference}``.
   * 4. Create a `WITHDRAWAL_DEBIT` entry with `escrowId: null` and the gateway reference.
   * 5. Queue `WithdrawalRecorded` with `this.addDomainEvent()`.
   * 6. Return the created entry for append.
   */
  recordWithdrawal(amountKobo: number, currency: Currency, gatewayReference: string, computedAvailableBalanceKobo: number): LedgerEntry;

  /**
   * Reverses active balance when an active escrow is cancelled or refunded.
   * 1. Compare `computedActiveBalanceKobo` with `amountKobo`.
   * 2. If active balance is too low, throw `InsufficientActiveBalanceError`.
   * 3. Build deterministic idempotency key `ACTIVE_ERRAND_REVERSAL_<escrowId>`.
   * 4. Create an `ACTIVE_ERRAND_REVERSAL` ledger entry with `LedgerEntry.create(...)`.
   * 5. Queue `ActiveErrandReversed` with `this.addDomainEvent()`.
   * 6. Return the entry for append.
   */
  recordActiveErrandReversal(amountKobo: number, currency: Currency, escrowId: EscrowId, gatewayReference: string, computedActiveBalanceKobo: number): LedgerEntry;

  /**
   * Records a client refund credit after payment gateway confirmation.
   * 1. Compare `currency` with `this.currency`.
   * 2. If currencies differ, throw `CurrencyMismatchError(this.currency, currency)`.
   * 3. Build deterministic refund idempotency key `REFUND_CREDIT_<escrowId>`.
   * 4. Create a `REFUND_CREDIT` ledger entry with `LedgerEntry.create(...)`.
   * 5. Queue `ClientRefunded` with `this.addDomainEvent()`.
   * 6. Return the entry for append.
   */
  recordClientRefund(amountKobo: number, currency: Currency, escrowId: EscrowId, gatewayReference: string): LedgerEntry;

  /**
   * Returns and clears queued wallet domain events after the ledger write succeeds.
   * 1. Read the aggregate's internal domain event array.
   * 2. Copy the events so the caller can publish them.
   * 3. Clear the aggregate's internal domain event array.
   * 4. Return the copied events to the handler.
   */
  pullDomainEvents(): DomainEvent[];
}

/**
 * Append-only money movement.
 * Constructor fields:
 * - `id: LedgerEntryId` identifies this immutable ledger row.
 * - `walletId: WalletId` ties the row to one wallet.
 * - `userId: UserId` denormalizes owner identity for reads/audit.
 * - `type: LedgerEntryType` defines the movement category.
 * - `amountKobo: number` stores the positive minor-unit amount.
 * - `currency: Currency` stores the movement currency.
 * - `escrowId: EscrowId | null` ties escrow movements to Escrow and remains null for withdrawals.
 * - `gatewayReference: string | null` links external payment records for reconciliation.
 * - `idempotencyKey: string` backs duplicate prevention with a DB unique constraint.
 */
class LedgerEntry {
  /**
   * Creates and validates a ledger entry.
   * 1. Validate `params.amountKobo > 0`; otherwise throw `InvalidLedgerAmountError`.
   * 2. Validate `params.walletId`, `params.userId`, `params.type`, `params.currency`, and `params.idempotencyKey` are present.
   * 3. Assign `params.escrowId ?? null` and `params.gatewayReference ?? null`.
   * 4. Create a new `LedgerEntryId` and `createdAt = new Date()`.
   * 5. Return the immutable LedgerEntry instance.
   */
  static create(params: CreateLedgerEntryParams): LedgerEntry;

  /**
   * Rehydrates a persisted ledger entry.
   * 1. Receive persisted `PersistedLedgerEntryParams` from `LedgerEntryMapper.toDomain()`.
   * 2. Rebuild `LedgerEntryId`, `WalletId`, and nullable `EscrowId` values from strings.
   * 3. Assign scalar amount, currency, gatewayReference, idempotencyKey, metadata, and createdAt.
   * 4. Do not validate as a new business action or emit events.
   * 5. Return the ledger entry for read models and balance replay.
   */
  static reconstitute(params: PersistedLedgerEntryParams): LedgerEntry;
}

/**
 * Materialized read model for active, pending, and available balances.
 * Constructor fields:
 * - `walletId: WalletId` identifies the wallet represented by the snapshot.
 * - `activeKobo: number` stores active errand balance.
 * - `pendingKobo: number` stores pending clearance balance.
 * - `availableKobo: number` stores withdrawable balance.
 * - `currency: Currency` stores snapshot currency.
 * - `rebuiltAt: Date` records the last full ledger replay.
 * - `updatedAt: Date` records the last incremental apply.
 */
class WalletBalanceSnapshot {
  /**
   * Rebuilds a snapshot from all ledger entries for a wallet.
   * 1. Receive authoritative ledger entries for `walletId`.
   * 2. Call `LedgerBalanceCalculator.calculate(entries)` to compute active, pending, and available totals.
   * 3. Use the calculated currency from ledger entries.
   * 4. Set `rebuiltAt` and `updatedAt` to `new Date()`.
   * 5. Return the rebuilt `WalletBalanceSnapshot`.
   */
  static fromLedger(walletId: WalletId, entries: LedgerEntry[]): WalletBalanceSnapshot;

  /**
   * Applies newly appended entries after the append succeeds.
   * 1. Iterate each appended `LedgerEntry`.
   * 2. Adjust active, pending, or available kobo fields according to `entry.type`.
   * 3. Preserve currency consistency with the existing snapshot.
   * 4. Set `updatedAt = new Date()`.
   * 5. Return the updated snapshot.
   */
  apply(entries: LedgerEntry[]): WalletBalanceSnapshot;
}

/**
 * Strongly typed wallet identifier.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class WalletId extends EntityId { static fromString(value: string): WalletId; }

/**
 * Strongly typed ledger entry identifier.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class LedgerEntryId extends EntityId { static fromString(value: string): LedgerEntryId; }

/**
 * Enumerates append-only ledger movements.
 * 1. Keep this shape serializable at the application boundary.
 * 2. Use primitive fields for data crossing out of the domain/application boundary.
 * 3. Keep domain EntityId values inside domain methods unless this interface explicitly requires them.
 */
enum LedgerEntryType {
  ACTIVE_ERRAND_CREDIT,
  ACTIVE_ERRAND_REVERSAL,
  PENDING_CREDIT,
  PENDING_REVERSAL,
  AVAILABLE_CREDIT,
  WITHDRAWAL_DEBIT,
  REFUND_CREDIT,
}

/**
 * Parameters required to create a ledger entry with replay-safe idempotency.
 * 1. Keep this shape serializable at the application boundary.
 * 2. Use primitive fields for data crossing out of the domain/application boundary.
 * 3. Keep domain EntityId values inside domain methods unless this interface explicitly requires them.
 */
interface CreateLedgerEntryParams {
  walletId: WalletId;
  userId: UserId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: Currency;
  escrowId: EscrowId | null;
  gatewayReference: string | null;
  idempotencyKey: string;
  metadata?: Json;
}

/**
 * Calculates balances by replaying ledger entries.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class LedgerBalanceCalculator {
  /**
   * Returns active, pending, and available kobo balances for the entry set.
   * 1. Initialize active, pending, and available totals to zero.
   * 2. Iterate `entries` in any order because each ledger type has deterministic arithmetic.
   * 3. Add `ACTIVE_ERRAND_CREDIT` to active and subtract `ACTIVE_ERRAND_REVERSAL` from active.
   * 4. Add `PENDING_CREDIT` to pending and subtract `PENDING_REVERSAL` from pending.
   * 5. Add `AVAILABLE_CREDIT` and `REFUND_CREDIT` to available and subtract `WITHDRAWAL_DEBIT` from available.
   * 6. Return `WalletBalancesDTO` with computed totals and currency.
   */
  calculate(entries: LedgerEntry[]): WalletBalancesDTO;
}

/**
 * Wallet repository interface for wallet aggregate identity.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IWalletRepository {
  /**
   * Loads a wallet by ID.
   * 1. Convert `id.toString()` into the Prisma where clause.
   * 2. Call `prisma.wallet.findUnique({ where: { id } })`.
   * 3. Return null when no row exists.
   * 4. Map the row with `WalletMapper.toDomain(row)` when present.
   */
  findById(id: WalletId): Promise<Wallet | null>;

  /**
   * Loads a wallet by owner.
   * 1. Convert `userId.toString()` into the Prisma where clause.
   * 2. Call `prisma.wallet.findUnique({ where: { userId } })` backed by `@@unique([userId])`.
   * 3. Return null when no row exists.
   * 4. Map the row with `WalletMapper.toDomain(row)` when present.
   */
  findByUserId(userId: UserId): Promise<Wallet | null>;

  /**
   * Persists wallet metadata.
   * 1. Convert the aggregate with `WalletMapper.toPersistence(wallet)`.
   * 2. Upsert the wallet row through Prisma.
   * 3. Translate unique `userId` failures into `WalletAlreadyExistsError`.
   * 4. Return after the durable write succeeds.
   */
  save(wallet: Wallet): Promise<void>;
}

/**
 * Append-only ledger repository.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface ILedgerEntryRepository {
  /**
   * Appends one entry and fails with DuplicateLedgerEntryError on duplicate idempotencyKey.
   * 1. Convert `entry` with `LedgerEntryMapper.toPersistence(entry)`.
   * 2. Call `prisma.ledgerEntry.create({ data })`.
   * 3. Catch Prisma unique-constraint failure on `idempotencyKey`.
   * 4. Throw `DuplicateLedgerEntryError(entry.idempotencyKey)` for that duplicate.
   * 5. Return after the row is durably written.
   */
  append(entry: LedgerEntry): Promise<void>;

  /**
   * Appends multiple entries atomically and fails on duplicate idempotencyKey.
   * 1. Convert each entry with `LedgerEntryMapper.toPersistence(entry)`.
   * 2. Open a Prisma transaction.
   * 3. Insert every entry inside the transaction.
   * 4. Roll back and throw `DuplicateLedgerEntryError` on idempotency-key collision.
   * 5. Commit only when every entry is inserted.
   */
  appendMany(entries: LedgerEntry[]): Promise<void>;

  /**
   * Returns wallet ledger history for reads and balance rebuilds.
   * 1. Convert `walletId.toString()` for the Prisma filter.
   * 2. Apply cursor pagination when `cursor` is not null.
   * 3. Query rows ordered by `createdAt` and backed by `@@index([walletId, createdAt])`.
   * 4. Map rows through `LedgerEntryMapper.toDomain(row)`.
   * 5. Return the domain ledger entries.
   */
  findByWalletId(walletId: WalletId, cursor: string | null, limit: number): Promise<LedgerEntry[]>;

  /**
   * Returns entries with a gateway reference for payment reconciliation.
   * 1. Validate `gatewayReference` is not empty.
   * 2. Query `prisma.ledgerEntry.findMany({ where: { gatewayReference } })`.
   * 3. Use `@@index([gatewayReference])` for reconciliation reads.
   * 4. Map rows with `LedgerEntryMapper.toDomain(row)`.
   * 5. Return every matching row so duplicates can be detected.
   */
  findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>;
}

/**
 * Balance snapshot repository for the materialized read model.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IWalletBalanceSnapshotRepository {
  /**
   * Applies just-appended entries after the ledger append succeeds.
   * 1. Load the existing snapshot by `walletId`.
   * 2. If absent, rebuild with `rebuild(walletId)` before applying deltas.
   * 3. Call `snapshot.apply(entries)` to mutate active/pending/available totals.
   * 4. Persist the snapshot with Prisma upsert on `walletId`.
   * 5. Return after the snapshot write succeeds.
   */
  apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>;

  /**
   * Loads the current snapshot if present.
   * 1. Convert `walletId.toString()` into the unique Prisma lookup.
   * 2. Query `prisma.walletBalanceSnapshot.findUnique({ where: { walletId } })`.
   * 3. Return null when no snapshot exists.
   * 4. Map the row through `WalletBalanceSnapshotMapper.toDomain(row)`.
   */
  findByWalletId(walletId: WalletId): Promise<WalletBalanceSnapshot | null>;

  /**
   * Rebuilds the snapshot from authoritative ledger entries.
   * 1. Load all ledger rows for `walletId` through `ILedgerEntryRepository.findByWalletId(...)` or the repository's unpaged rebuild path.
   * 2. Call `WalletBalanceSnapshot.fromLedger(walletId, entries)`.
   * 3. Persist the rebuilt snapshot with Prisma upsert on `walletId`.
   * 4. Return the rebuilt snapshot.
   */
  rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>;
}

/**
 * Emitted after active errand credit is appended and snapshot is updated.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ActiveErrandCredited implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/**
 * Emitted after active balance moves into pending clearance.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class MovedToPending implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/**
 * Emitted after pending balance clears into available balance.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ReleasedToAvailable implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/**
 * Emitted after withdrawal debit is appended.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class WithdrawalRecorded implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly amountKobo: number, public readonly gatewayReference: string); }
/**
 * Emitted after active errand balance is reversed.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ActiveErrandReversed implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/**
 * Emitted after a client refund credit is appended.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ClientRefunded implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly gatewayReference: string); }
/**
 * Emitted by reconciliation when gateway and ledger records disagree.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class LedgerDiscrepancyDetected implements DomainEvent { constructor(public readonly gatewayReference: string, public readonly discrepancyType: 'missing' | 'duplicate' | 'amount-mismatch', public readonly amountKobo: number, public readonly occurredAt: Date); }
```

### Application Layer

```typescript
import { Command, CommandBus, CommandHandler, EventBus, ICommandHandler, IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for crediting active errand balance.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreditActiveErrandCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(CreditActiveErrandCommand)
class CreditActiveErrandHandler implements ICommandHandler<CreditActiveErrandCommand> {
  /**
   * Credits a worker's active-errand balance when an escrow is funded.
   * 1. Load the Wallet aggregate via `walletRepository.findById(command.walletId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(command.walletId)`.
   * 3. Call `wallet.recordActiveErrandCredit(command.amountKobo, command.currency, command.escrowId, command.gatewayReference)` to produce a validated `LedgerEntry` and queue `ActiveErrandCredited`.
   * 4. Persist the entry via `ledgerEntryRepository.append(entry)`. This is a single-entry, no-balance-check write because credits cannot overdraw.
   * 5. Update the read-side cache via `walletBalanceSnapshotRepository.apply(wallet.id, [entry])`, incrementing active balance in `WalletBalanceSnapshot`.
   * 6. Only after step 4 succeeds, call `wallet.pullDomainEvents()` and `eventBus.publish(event)` for each event.
   * @throws WalletNotFoundError when no wallet exists for `command.walletId`.
   * @throws InvalidLedgerAmountError when `LedgerEntry.create()` rejects `command.amountKobo`.
   * @throws DuplicateLedgerEntryError when the `idempotencyKey` unique constraint rejects a duplicate credit.
   * @emits ActiveErrandCredited
   */
  async execute(command: CreditActiveErrandCommand): Promise<void>;
}

/**
 * Command input for moving active balance to pending.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class MoveActiveToPendingCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(MoveActiveToPendingCommand)
class MoveActiveToPendingHandler implements ICommandHandler<MoveActiveToPendingCommand> {
  /**
   * Moves active errand balance into pending clearance.
   * 1. Load the Wallet aggregate via `walletRepository.findById(command.walletId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(command.walletId)`.
   * 3. Enter the bounded `retryPolicy.forTransientTransactionError()` loop used for balance-checked appends.
   * 4. Inside the transaction, load ledger rows via `ledgerEntryRepository.findByWalletId(command.walletId, null, BALANCE_REPLAY_LIMIT)` and compute active balance with `LedgerBalanceCalculator.calculate(entries)`.
   * 5. Call `wallet.moveActiveToPending(command.amountKobo, command.currency, command.escrowId, balances.activeKobo)` to validate balance and produce debit/credit entries.
   * 6. Persist both entries with `ledgerEntryRepository.appendManyIfBalanceSufficient(entriesToAppend, balances.activeKobo)` or the repository transaction equivalent.
   * 7. Retry the whole read-compute-append sequence only when the repository throws `TransientTransactionError`; do not retry insufficient-balance or duplicate-idempotency failures.
   * 8. Apply the materialized view delta with `walletBalanceSnapshotRepository.apply(wallet.id, entriesToAppend)`.
   * 9. Publish `wallet.pullDomainEvents()` through `eventBus.publish(event)` only after append success.
   * @throws InsufficientActiveBalanceError when active balance is below `command.amountKobo`.
   * @throws DuplicateLedgerEntryError when either deterministic idempotency key already exists.
   * @emits MovedToPending
   */
  async execute(command: MoveActiveToPendingCommand): Promise<void>;
}

/**
 * Command input for releasing pending balance to available.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class ReleaseToAvailableCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(ReleaseToAvailableCommand)
class ReleaseToAvailableHandler implements ICommandHandler<ReleaseToAvailableCommand> {
  /**
   * Releases pending clearance balance into available balance.
   * 1. Load the Wallet aggregate via `walletRepository.findById(command.walletId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(command.walletId)`.
   * 3. Enter the bounded `retryPolicy.forTransientTransactionError()` loop used for balance-checked appends.
   * 4. Inside the transaction, load ledger rows via `ledgerEntryRepository.findByWalletId(command.walletId, null, BALANCE_REPLAY_LIMIT)` and compute pending balance with `LedgerBalanceCalculator.calculate(entries)`.
   * 5. Call `wallet.moveToAvailable(command.amountKobo, command.currency, command.escrowId, balances.pendingKobo)` to produce pending reversal and available credit entries.
   * 6. Persist with `ledgerEntryRepository.appendManyIfBalanceSufficient(entriesToAppend, balances.pendingKobo)` or the repository transaction equivalent.
   * 7. Retry only on `TransientTransactionError`; treat `InsufficientPendingBalanceError`, invalid amount, and duplicate idempotency as final failures.
   * 8. Call `walletBalanceSnapshotRepository.apply(wallet.id, entriesToAppend)` after append success.
   * 9. Publish each event from `wallet.pullDomainEvents()` with `eventBus.publish(event)`.
   * @throws InsufficientPendingBalanceError when pending balance cannot cover the release.
   * @emits ReleasedToAvailable
   */
  async execute(command: ReleaseToAvailableCommand): Promise<void>;
}

/**
 * Command input for a withdrawal that is keyed by gatewayReference, not escrowId.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RecordWithdrawalCommand extends Command<void> { constructor(public readonly userId: UserId, public readonly walletId: WalletId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(RecordWithdrawalCommand)
class RecordWithdrawalHandler implements ICommandHandler<RecordWithdrawalCommand> {
  /**
   * Records an external withdrawal against available balance.
   * 1. Load the Wallet aggregate via `walletRepository.findById(command.walletId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(command.walletId)`.
   * 3. Enter the bounded `retryPolicy.forTransientTransactionError()` loop for balance-checked debits.
   * 4. Inside the transaction, compute available balance from `ledgerEntryRepository.findByWalletId(...)` using `LedgerBalanceCalculator.calculate(entries)`.
   * 5. Call `wallet.recordWithdrawal(command.amountKobo, command.currency, command.gatewayReference, balances.availableKobo)`, which builds `WITHDRAWAL_DEBIT:<gatewayReference>` as the idempotency key.
   * 6. Persist with `ledgerEntryRepository.appendManyIfBalanceSufficient([entry], balances.availableKobo)` or the repository transaction equivalent.
   * 7. Retry only on `TransientTransactionError`; do not retry `InsufficientAvailableBalanceError`, `InvalidLedgerAmountError`, or `DuplicateLedgerEntryError`.
   * 8. Apply the snapshot update via `walletBalanceSnapshotRepository.apply(wallet.id, [entry])`.
   * 9. Publish `WithdrawalRecorded` from `wallet.pullDomainEvents()` after append success.
   * @emits WithdrawalRecorded
   */
  async execute(command: RecordWithdrawalCommand): Promise<void>;
}

/**
 * Command input for reversing active errand balance.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class ReverseActiveErrandCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(ReverseActiveErrandCommand)
class ReverseActiveErrandHandler implements ICommandHandler<ReverseActiveErrandCommand> {
  /**
   * Reverses active balance for a cancelled or refunded active escrow.
   * 1. Load the Wallet aggregate via `walletRepository.findById(command.walletId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(command.walletId)`.
   * 3. Enter the bounded `retryPolicy.forTransientTransactionError()` loop for balance-checked reversals.
   * 4. Compute active balance from current ledger rows with `LedgerBalanceCalculator.calculate(...)`.
   * 5. Call `wallet.recordActiveErrandReversal(command.amountKobo, command.currency, command.escrowId, command.gatewayReference, balances.activeKobo)`.
   * 6. Persist with `ledgerEntryRepository.appendManyIfBalanceSufficient([entry], balances.activeKobo)` or the repository transaction equivalent.
   * 7. Retry only on `TransientTransactionError`; treat insufficient active balance and duplicate idempotency as final failures.
   * 8. Apply `walletBalanceSnapshotRepository.apply(wallet.id, [entry])`.
   * 9. Publish `ActiveErrandReversed` after the append succeeds.
   * @emits ActiveErrandReversed
   */
  async execute(command: ReverseActiveErrandCommand): Promise<void>;
}

/**
 * Command input for recording a successful client refund.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RecordClientRefundCommand extends Command<void> { constructor(public readonly clientUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(RecordClientRefundCommand)
class RecordClientRefundHandler implements ICommandHandler<RecordClientRefundCommand> {
  /**
   * Records a confirmed client refund credit.
   * 1. Load the client Wallet aggregate via `walletRepository.findById(command.walletId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(command.walletId)`.
   * 3. Call `wallet.recordClientRefund(command.amountKobo, command.currency, command.escrowId, command.gatewayReference)` to validate currency and create a `REFUND_CREDIT` entry.
   * 4. Persist with `ledgerEntryRepository.append(entry)` using the deterministic refund idempotency key.
   * 5. Apply `walletBalanceSnapshotRepository.apply(wallet.id, [entry])` after append success.
   * 6. Publish events from `wallet.pullDomainEvents()` through `eventBus.publish(event)`.
   * @throws CurrencyMismatchError when refund currency differs from wallet currency.
   * @emits ClientRefunded
   */
  async execute(command: RecordClientRefundCommand): Promise<void>;
}

/**
 * Command input for replaying an externally successful payment whose ledger append failed.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class AppendFailedLedgerEntryCommand extends Command<void> { constructor(public readonly payload: AppendFailedLedgerEntryPayload); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` appends and queries ledger entries.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` updates balance snapshots.
 * - `eventBus: EventBus` publishes wallet domain events after writes.
 */
@CommandHandler(AppendFailedLedgerEntryCommand)
class AppendFailedLedgerEntryHandler implements ICommandHandler<AppendFailedLedgerEntryCommand> {
  /**
   * Replays a ledger append after an external payment succeeded but the first append failed.
   * 1. Validate `command.payload` includes `walletId`, `userId`, `ledgerEntryType`, `amountKobo`, `currency`, `gatewayReference`, and `idempotencyKey`.
   * 2. Load the Wallet aggregate via `walletRepository.findById(command.payload.walletId)`.
   * 3. If wallet is null, throw `WalletNotFoundError(command.payload.walletId)`.
   * 4. Recreate the ledger entry with `LedgerEntry.create(command.payload)` or the matching Wallet domain method when escrow semantics apply.
   * 5. Append via `ledgerEntryRepository.append(entry)`; if `DuplicateLedgerEntryError` is thrown for the same idempotency key, treat replay as already completed.
   * 6. Apply `walletBalanceSnapshotRepository.apply(wallet.id, [entry])` after a successful append.
   * 7. Publish any queued wallet events after append success.
   * @throws InvalidLedgerAmountError when replay payload amount is invalid
   */
  async execute(command: AppendFailedLedgerEntryCommand): Promise<void>;
}

/**
 * Query input for current wallet balances.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetWalletBalancesQuery extends Query<WalletBalancesDTO> { constructor(public readonly userId: UserId); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` reads ledger history when needed.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` reads or rebuilds balance snapshots.
 */
@QueryHandler(GetWalletBalancesQuery)
class GetWalletBalancesHandler implements IQueryHandler<GetWalletBalancesQuery> {
  /**
   * Returns current wallet balances from the materialized snapshot.
   * 1. Load the wallet via `walletRepository.findByUserId(query.userId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(query.userId)`.
   * 3. Load the snapshot via `walletBalanceSnapshotRepository.findByWalletId(wallet.id)`.
   * 4. If the snapshot is missing or marked stale, call `walletBalanceSnapshotRepository.rebuild(wallet.id)` using authoritative ledger rows.
   * 5. Return `WalletBalancesDTO` with `activeKobo`, `pendingKobo`, `availableKobo`, and `currency` from the snapshot.
   * @throws WalletNotFoundError when the user wallet does not exist
   */
  async execute(query: GetWalletBalancesQuery): Promise<WalletBalancesDTO>;
}

/**
 * Query input for paginated ledger history.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetLedgerHistoryQuery extends Query<LedgerHistoryPageDTO> { constructor(public readonly userId: UserId, public readonly cursor: string | null, public readonly limit: number); }
/**
 * Handler constructor dependencies:
 * - `walletRepository: IWalletRepository` loads Wallet aggregates.
 * - `ledgerEntryRepository: ILedgerEntryRepository` reads ledger history when needed.
 * - `walletBalanceSnapshotRepository: IWalletBalanceSnapshotRepository` reads or rebuilds balance snapshots.
 */
@QueryHandler(GetLedgerHistoryQuery)
class GetLedgerHistoryHandler implements IQueryHandler<GetLedgerHistoryQuery> {
  /**
   * Returns paginated ledger history with DTO-safe primitive IDs.
   * 1. Load the caller wallet with `walletRepository.findByUserId(query.userId)`.
   * 2. If wallet is null, throw `WalletNotFoundError(query.userId)`.
   * 3. Query ledger entries with `ledgerEntryRepository.findByWalletId(wallet.id, query.cursor, query.limit)`.
   * 4. Map each `LedgerEntry` to `LedgerEntryDTO` and explicitly convert IDs with `.toString()`: `id = entry.id.toString()` and `escrowId = entry.escrowId ? entry.escrowId.toString() : null`.
   * 5. Compute `nextCursor` from the last returned ledger entry when the page is full.
   * 6. Return `LedgerHistoryPageDTO`; do not return GraphQL types or Prisma rows.
   */
  async execute(query: GetLedgerHistoryQuery): Promise<LedgerHistoryPageDTO>;
}

/**
 * DTO returned by GetWalletBalancesQuery.
 * 1. Keep this shape serializable at the application boundary.
 * 2. Use primitive fields for data crossing out of the domain/application boundary.
 * 3. Keep domain EntityId values inside domain methods unless this interface explicitly requires them.
 */
interface WalletBalancesDTO { activeKobo: number; pendingKobo: number; availableKobo: number; currency: Currency; }
/**
 * DTO returned by GetLedgerHistoryQuery.
 * 1. Keep this shape serializable at the application boundary.
 * 2. Use primitive fields for data crossing out of the domain/application boundary.
 * 3. Keep domain EntityId values inside domain methods unless this interface explicitly requires them.
 */
interface LedgerHistoryPageDTO { entries: LedgerEntryDTO[]; nextCursor: string | null; }
/**
 * User-facing ledger DTO with EntityId values flattened to primitive strings at the application boundary.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface LedgerEntryDTO { id: string; type: LedgerEntryType; amountKobo: number; currency: Currency; escrowId: string | null; gatewayReference: string | null; createdAt: Date; }
```

### Application Jobs

```typescript
/**
 * Payload for one reconciliation window.
 * 1. Keep this shape serializable at the application boundary.
 * 2. Use primitive fields for data crossing out of the domain/application boundary.
 * 3. Keep domain EntityId values inside domain methods unless this interface explicitly requires them.
 */
interface ReconcileLedgerPayload { windowStart: Date; windowEnd: Date; provider: 'paystack' | 'webhook-log'; cursor: string | null; correlationId: string; }

/**
 * Scheduler/query side: partitions time into windows and enqueues one BullMQ reconciliation job per window.
 * Constructor dependencies:
 * - repository/query service dependency finds eligible records or windows.
 * - `queue: Queue` enqueues BullMQ payloads.
 * - `logger: ILogger` records enqueue failures and cursors.
 */
class ReconcileLedgerJob {
  /**
   * Enqueues ledger reconciliation work by time window.
   * 1. Read the next due audit window from the scheduler state.
   * 2. Split the window by provider source: `paystack` transaction API or stored `webhook-log`.
   * 3. Enqueue one BullMQ job per source/window with `queue.add('wallet_reconcile_ledger', payload, retryOptions)`.
   * 4. Persist the scheduler cursor only after enqueue succeeds.
   * 5. Do not compare gateway records inline in the scheduler tick.
   */
  async enqueueDueJobs(windowStart: Date, windowEnd: Date): Promise<void>;
}

/**
 * Processor that compares Paystack transaction API or stored webhook logs against LedgerEntry.gatewayReference.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches the use case for one job payload.
 * - repository/adapter dependencies load job-specific context when needed.
 * - `logger: ILogger` records retry and DLQ failures.
 */
@Processor('wallet_reconcile_ledger')
class ReconcileLedgerProcessor {
  /**
   * Compares gateway/payment records with wallet ledger rows.
   * 1. Fetch gateway records with `paystackLedgerAuditAdapter.fetchTransactions(job.data.windowStart, job.data.windowEnd, job.data.cursor)` or read stored webhook logs for the same window.
   * 2. For each record, call `ledgerEntryRepository.findByGatewayReference(record.gatewayReference)`.
   * 3. Classify discrepancies as `missing`, `duplicate`, or `amount-mismatch` by comparing row count and amountKobo.
   * 4. Publish `eventBus.publish(new LedgerDiscrepancyDetected(...))` or persist the audit report for every discrepancy.
   * 5. Retry transient gateway or repository failures through BullMQ backoff.
   * 6. After retries exhaust, move `windowStart`, `windowEnd`, `provider`, `cursor`, `correlationId`, and failure reason into DLQ.
   */
  async process(job: Job<ReconcileLedgerPayload>): Promise<void>;
}

/**
 * Payload needed to safely append a ledger entry after an external payment succeeded but the ledger append failed.
 * 1. Keep this shape serializable at the application boundary.
 * 2. Use primitive fields for data crossing out of the domain/application boundary.
 * 3. Keep domain EntityId values inside domain methods unless this interface explicitly requires them.
 */
interface AppendFailedLedgerEntryPayload { walletId: WalletId; userId: UserId; ledgerEntryType: LedgerEntryType; amountKobo: number; currency: Currency; escrowId: EscrowId | null; gatewayReference: string; idempotencyKey: string; rawGatewayEventId: string; correlationId: string; }

/**
 * Scheduler/query side for retrying failed ledger appends; enqueues one job per persisted failure record.
 * Constructor dependencies:
 * - repository/query service dependency finds eligible records or windows.
 * - `queue: Queue` enqueues BullMQ payloads.
 * - `logger: ILogger` records enqueue failures and cursors.
 */
class AppendFailedLedgerEntryJob {
  /**
   * Enqueues failed ledger append replay records.
   * 1. Query persisted failed append records whose retry time has elapsed.
   * 2. For each record, build `AppendFailedLedgerEntryPayload` with walletId, userId, ledgerEntryType, amountKobo, currency, escrowId, gatewayReference, idempotencyKey, rawGatewayEventId, and correlationId.
   * 3. Enqueue one BullMQ job with `queue.add('wallet_append_failed_ledger_entry', payload, retryOptions)`.
   * 4. Mark the failed append record as enqueued after `queue.add` succeeds.
   * 5. Do not append ledger rows directly from the scheduler.
   */
  async enqueueDueJobs(): Promise<void>;
}

/**
 * BullMQ worker for replaying failed ledger appends through CommandBus.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches the use case for one job payload.
 * - repository/adapter dependencies load job-specific context when needed.
 * - `logger: ILogger` records retry and DLQ failures.
 */
@Processor('wallet_append_failed_ledger_entry')
class AppendFailedLedgerEntryProcessor {
  /**
   * Replays failed ledger appends through CommandBus.
   * 1. Validate the replay payload contains every field needed by `AppendFailedLedgerEntryCommand`.
   * 2. Dispatch `commandBus.execute(new AppendFailedLedgerEntryCommand(job.data))`.
   * 3. Treat `DuplicateLedgerEntryError` for `job.data.idempotencyKey` as success because the append already exists.
   * 4. Retry transient repository failures with BullMQ exponential backoff.
   * 5. After retries exhaust, write a DLQ entry containing the original payload, failure reason, and attempt count.
   * 6. Preserve the idempotency key in the DLQ payload so manual replay cannot double-credit.
   */
  async process(job: Job<AppendFailedLedgerEntryPayload>): Promise<void>;
}
```

### Infrastructure And Presentation Layers

```typescript
/**
 * Prisma implementation of `IWalletRepository`.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes Wallet persistence operations.
 * - `walletMapper: WalletMapper` maps between Prisma rows and Wallet aggregates.
 */
@Injectable()
class PrismaWalletRepository implements IWalletRepository { async findById(id: WalletId): Promise<Wallet | null>; async findByUserId(userId: UserId): Promise<Wallet | null>; async save(wallet: Wallet): Promise<void>; }
/**
 * Prisma implementation of `ILedgerEntryRepository` with idempotency handling.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes LedgerEntry writes and reads.
 * - `ledgerEntryMapper: LedgerEntryMapper` maps persistence rows to LedgerEntry entities.
 */
@Injectable()
class PrismaLedgerEntryRepository implements ILedgerEntryRepository { async append(entry: LedgerEntry): Promise<void>; async appendMany(entries: LedgerEntry[]): Promise<void>; async findByWalletId(walletId: WalletId, cursor: string | null, limit: number): Promise<LedgerEntry[]>; async findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>; }
/**
 * Prisma implementation of `IWalletBalanceSnapshotRepository`.
 * Constructor dependencies:
 * - `prisma: PrismaService` persists snapshot rows.
 * - `walletBalanceSnapshotMapper: WalletBalanceSnapshotMapper` maps snapshot rows.
 * - `ledgerEntryRepository: ILedgerEntryRepository` supplies authoritative ledger entries for rebuilds.
 */
@Injectable()
class PrismaWalletBalanceSnapshotRepository implements IWalletBalanceSnapshotRepository { async apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>; async findByWalletId(walletId: WalletId): Promise<WalletBalanceSnapshot | null>; async rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>; }
/**
 * Injectable mapper for Wallet.
 * 1. `toDomain(row)` converts `row.id` and `row.userId` to typed IDs and calls `Wallet.reconstitute(...)`.
 * 2. `toPersistence(wallet)` converts `wallet.id` and `wallet.userId` with `.toString()` and returns Prisma data.
 */
@Injectable()
class WalletMapper { toDomain(row: unknown): Wallet; toPersistence(wallet: Wallet): unknown; }
/**
 * Injectable mapper for LedgerEntry.
 * 1. `toDomain(row)` converts `id`, `walletId`, and nullable `escrowId` strings to typed IDs.
 * 2. `toPersistence(entry)` flattens IDs with `.toString()` and preserves `gatewayReference`, `idempotencyKey`, and metadata.
 */
@Injectable()
class LedgerEntryMapper { toDomain(row: unknown): LedgerEntry; toPersistence(entry: LedgerEntry): unknown; }
/**
 * Injectable mapper for WalletBalanceSnapshot.
 * 1. `toDomain(row)` rebuilds the snapshot value object from persisted totals.
 * 2. `toPersistence(snapshot)` flattens `walletId` and balance totals for Prisma upsert.
 */
@Injectable()
class WalletBalanceSnapshotMapper { toDomain(row: unknown): WalletBalanceSnapshot; toPersistence(snapshot: WalletBalanceSnapshot): unknown; }
/**
 * Adapter for Paystack transaction audit queries used by `ReconcileLedgerProcessor`.
 * Constructor dependencies:
 * - `paystackClient: PaystackClient` calls Paystack transaction APIs.
 * - `logger: ILogger` records gateway audit failures and cursors.
 */
@Injectable()
class PaystackLedgerAuditAdapter { fetchTransactions(windowStart: Date, windowEnd: Date, cursor: string | null): Promise<GatewayLedgerTransactionPage>; }

/**
 * GraphQL resolver; injects buses, never repositories.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches wallet mutations when exposed.
 * - `queryBus: QueryBus` dispatches `GetWalletBalancesQuery` and `GetLedgerHistoryQuery`.
 */
@Resolver()
class WalletResolver { constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus); }

/**
 * GraphQL type for wallet balances; this is separate from WalletBalancesDTO.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class WalletBalancesType implements WalletBalancesDTO { activeKobo: number; pendingKobo: number; availableKobo: number; currency: Currency; }
/**
 * Explicit balance DTO to GraphQL conversion.
 * 1. Receive the application DTO returned by a query handler.
 * 2. Convert EntityId values to strings when present.
 * 3. Copy scalar fields to the GraphQL type.
 * 4. Return the presentation type.
 */
function toWalletBalancesType(dto: WalletBalancesDTO): WalletBalancesType;

/**
 * GraphQL type for ledger rows; IDs are already primitive strings in LedgerEntryDTO.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class LedgerEntryGraphQLType implements LedgerEntryDTO { id: string; type: LedgerEntryType; amountKobo: number; currency: Currency; escrowId: string | null; gatewayReference: string | null; createdAt: Date; }
/**
 * Explicit ledger DTO to GraphQL conversion.
 * 1. Receive the application DTO returned by a query handler.
 * 2. Convert EntityId values to strings when present.
 * 3. Copy scalar fields to the GraphQL type.
 * 4. Return the presentation type.
 */
function toLedgerEntryGraphQLType(dto: LedgerEntryDTO): LedgerEntryGraphQLType;

/**
 * GraphQL shape for a ledger history page.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type LedgerHistoryPageGraphQLShape = Omit<LedgerHistoryPageDTO, 'entries'> & { entries: LedgerEntryGraphQLType[] };
/**
 * GraphQL type for paginated ledger history.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class LedgerHistoryPageType implements LedgerHistoryPageGraphQLShape { entries: LedgerEntryGraphQLType[]; nextCursor: string | null; }
/**
 * Explicit page DTO to GraphQL conversion.
 * 1. Receive the application DTO returned by a query handler.
 * 2. Convert EntityId values to strings when present.
 * 3. Copy scalar fields to the GraphQL type.
 * 4. Return the presentation type.
 */
function toLedgerHistoryPageType(dto: LedgerHistoryPageDTO): LedgerHistoryPageType;
```

## EIP Patterns Applied

- **Event Sourcing / Append-Only Log**: `LedgerEntry` is the authoritative wallet history and every balance can be replayed. Status: fully specced with concrete signatures in the Implementation Spec.
- **Materialized View**: `WalletBalanceSnapshot` is updated synchronously after each successful ledger append through `walletBalanceSnapshotRepository.apply(walletId, entries)` and rebuilt on stale/missing reads. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: Every ledger append has an `idempotencyKey`; escrow flows key off `escrowId`, while `recordWithdrawal()` keys off `gatewayReference` because withdrawals are not escrow-bound. Status: fully specced with concrete signatures in the Implementation Spec.
- **Reconciliation / Audit**: `ReconcileLedgerJob` and `ReconcileLedgerProcessor` compare Paystack transactions or stored webhook logs against ledger rows by `gatewayReference` and report missing, duplicate, and amount-mismatched entries. Status: fully specced with concrete signatures in the Implementation Spec.
- **Dead Letter Channel**: `AppendFailedLedgerEntryJob` and `AppendFailedLedgerEntryProcessor` retry externally successful payment events whose ledger append failed; DLQ payloads include all fields needed for replay, and the unique idempotency key prevents double-crediting. Status: fully specced with concrete signatures in the Implementation Spec.
