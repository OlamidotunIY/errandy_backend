# Wallet - DDD & EIP Analysis

## Current Responsibility

Wallet owns money movements after external payment outcomes are known. Balances are derived from append-only `LedgerEntry` records; active, pending, and available amounts are projections rather than mutable source-of-truth fields.

## Domain Model

`Wallet` is the aggregate root and `WalletId` is the strongly typed aggregate identifier. `LedgerEntry` is the append-only money movement record and `WalletBalanceSnapshot` is the materialized read model. Escrow-related movements key idempotency by `escrowId`; withdrawals key idempotency by `gatewayReference` because they are not tied to an escrow.

Domain events are queued inside `Wallet` with `addDomainEvent()`. Application handlers append ledger entries first, update the balance snapshot after the append succeeds, then publish `wallet.pullDomainEvents()` through `this.eventBus.publish(event)`.

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
/** Aggregate root for wallet ownership and ledger-producing behaviors. */
class Wallet extends AggregateRoot<WalletId> {
  /** Creates a wallet for a user and currency. */
  static create(userId: UserId, currency: Currency): Wallet;

  /** Rehydrates persisted wallet state without recording events. */
  static reconstitute(id: WalletId, userId: UserId, currency: Currency, createdAt: Date, updatedAt: Date): Wallet;

  /** Records worker active balance for a funded errand; idempotencyKey is ACTIVE_ERRAND_CREDIT:<escrowId>. */
  recordActiveErrandCredit(amountKobo: number, currency: Currency, escrowId: EscrowId, gatewayReference: string): LedgerEntry;

  /** Moves active errand balance into pending clearance; writes an active reversal and pending credit. */
  moveActiveToPending(amountKobo: number, currency: Currency, escrowId: EscrowId, computedActiveBalanceKobo: number): LedgerEntry[];

  /** Moves pending clearance balance into available balance after the clearance window matures. */
  moveToAvailable(amountKobo: number, currency: Currency, escrowId: EscrowId, computedPendingBalanceKobo: number): LedgerEntry[];

  /** Records an external withdrawal; idempotencyKey is WITHDRAWAL_DEBIT:<gatewayReference>. */
  recordWithdrawal(amountKobo: number, currency: Currency, gatewayReference: string, computedAvailableBalanceKobo: number): LedgerEntry;

  /** Reverses active balance when an active escrow is cancelled or refunded. */
  recordActiveErrandReversal(amountKobo: number, currency: Currency, escrowId: EscrowId, gatewayReference: string, computedActiveBalanceKobo: number): LedgerEntry;

  /** Records a client refund credit after the payment gateway confirms refund success. */
  recordClientRefund(amountKobo: number, currency: Currency, escrowId: EscrowId, gatewayReference: string): LedgerEntry;

  /** Returns and clears queued wallet domain events after the ledger write succeeds. */
  pullDomainEvents(): DomainEvent[];
}

/** Append-only money movement. */
class LedgerEntry {
  /** Creates and validates a ledger entry. */
  static create(params: CreateLedgerEntryParams): LedgerEntry;

  /** Rehydrates a persisted ledger entry. */
  static reconstitute(params: PersistedLedgerEntryParams): LedgerEntry;
}

/** Materialized read model for active, pending, and available balances. */
class WalletBalanceSnapshot {
  /** Rebuilds a snapshot from all ledger entries for a wallet. */
  static fromLedger(walletId: WalletId, entries: LedgerEntry[]): WalletBalanceSnapshot;

  /** Applies newly appended entries after the append succeeds. */
  apply(entries: LedgerEntry[]): WalletBalanceSnapshot;
}

/** Strongly typed wallet identifier. */
class WalletId extends EntityId { static fromString(value: string): WalletId; }

/** Strongly typed ledger entry identifier. */
class LedgerEntryId extends EntityId { static fromString(value: string): LedgerEntryId; }

/** Enumerates append-only ledger movements. */
enum LedgerEntryType {
  ACTIVE_ERRAND_CREDIT,
  ACTIVE_ERRAND_REVERSAL,
  PENDING_CREDIT,
  PENDING_REVERSAL,
  AVAILABLE_CREDIT,
  WITHDRAWAL_DEBIT,
  REFUND_CREDIT,
}

/** Parameters required to create a ledger entry with replay-safe idempotency. */
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

/** Calculates balances by replaying ledger entries. */
class LedgerBalanceCalculator {
  /** Returns active, pending, and available kobo balances for the entry set. */
  calculate(entries: LedgerEntry[]): WalletBalancesDTO;
}

/** Wallet repository interface for wallet aggregate identity. */
interface IWalletRepository {
  /** Loads a wallet by ID. */
  findById(id: WalletId): Promise<Wallet | null>;

  /** Loads a wallet by owner. */
  findByUserId(userId: UserId): Promise<Wallet | null>;

  /** Persists wallet metadata. */
  save(wallet: Wallet): Promise<void>;
}

/** Append-only ledger repository. */
interface ILedgerEntryRepository {
  /** Appends one entry and fails with DuplicateLedgerEntryError on duplicate idempotencyKey. */
  append(entry: LedgerEntry): Promise<void>;

  /** Appends multiple entries atomically and fails on duplicate idempotencyKey. */
  appendMany(entries: LedgerEntry[]): Promise<void>;

  /** Returns wallet ledger history for reads and balance rebuilds. */
  findByWalletId(walletId: WalletId, cursor: string | null, limit: number): Promise<LedgerEntry[]>;

  /** Returns entries with a gateway reference for payment reconciliation. */
  findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>;
}

/** Balance snapshot repository for the materialized read model. */
interface IWalletBalanceSnapshotRepository {
  /** Applies just-appended entries after the ledger append succeeds. */
  apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>;

  /** Loads the current snapshot if present. */
  findByWalletId(walletId: WalletId): Promise<WalletBalanceSnapshot | null>;

  /** Rebuilds the snapshot from authoritative ledger entries. */
  rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>;
}

/** Emitted after active errand credit is appended and snapshot is updated. */
class ActiveErrandCredited implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/** Emitted after active balance moves into pending clearance. */
class MovedToPending implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/** Emitted after pending balance clears into available balance. */
class ReleasedToAvailable implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/** Emitted after withdrawal debit is appended. */
class WithdrawalRecorded implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly amountKobo: number, public readonly gatewayReference: string); }
/** Emitted after active errand balance is reversed. */
class ActiveErrandReversed implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number); }
/** Emitted after a client refund credit is appended. */
class ClientRefunded implements DomainEvent { constructor(public readonly walletId: WalletId, public readonly userId: UserId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly gatewayReference: string); }
/** Emitted by reconciliation when gateway and ledger records disagree. */
class LedgerDiscrepancyDetected implements DomainEvent { constructor(public readonly gatewayReference: string, public readonly discrepancyType: 'missing' | 'duplicate' | 'amount-mismatch', public readonly amountKobo: number, public readonly occurredAt: Date); }
```

### Application Layer

```typescript
import { Command, CommandBus, CommandHandler, EventBus, ICommandHandler, IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

/** Command input for crediting active errand balance. */
class CreditActiveErrandCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/** Appends ACTIVE_ERRAND_CREDIT, applies WalletBalanceSnapshot, then publishes ActiveErrandCredited. */
@CommandHandler(CreditActiveErrandCommand)
class CreditActiveErrandHandler implements ICommandHandler<CreditActiveErrandCommand> {
  /** Executes with ledgerEntryRepository.append(entry), walletBalanceSnapshotRepository.apply(wallet.id, [entry]), then eventBus.publish(events). */
  async execute(command: CreditActiveErrandCommand): Promise<void>;
}

/** Command input for moving active balance to pending. */
class MoveActiveToPendingCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency); }
/** Appends active reversal and pending credit, updates snapshot, then publishes MovedToPending. */
@CommandHandler(MoveActiveToPendingCommand)
class MoveActiveToPendingHandler implements ICommandHandler<MoveActiveToPendingCommand> { async execute(command: MoveActiveToPendingCommand): Promise<void>; }

/** Command input for releasing pending balance to available. */
class ReleaseToAvailableCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency); }
/** Appends pending reversal and available credit, updates snapshot, then publishes ReleasedToAvailable. */
@CommandHandler(ReleaseToAvailableCommand)
class ReleaseToAvailableHandler implements ICommandHandler<ReleaseToAvailableCommand> { async execute(command: ReleaseToAvailableCommand): Promise<void>; }

/** Command input for a withdrawal that is keyed by gatewayReference, not escrowId. */
class RecordWithdrawalCommand extends Command<void> { constructor(public readonly userId: UserId, public readonly walletId: WalletId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/** Appends WITHDRAWAL_DEBIT with idempotencyKey WITHDRAWAL_DEBIT:<gatewayReference>, updates snapshot, then publishes WithdrawalRecorded. */
@CommandHandler(RecordWithdrawalCommand)
class RecordWithdrawalHandler implements ICommandHandler<RecordWithdrawalCommand> { async execute(command: RecordWithdrawalCommand): Promise<void>; }

/** Command input for reversing active errand balance. */
class ReverseActiveErrandCommand extends Command<void> { constructor(public readonly workerUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/** Appends ACTIVE_ERRAND_REVERSAL, updates snapshot, then publishes ActiveErrandReversed. */
@CommandHandler(ReverseActiveErrandCommand)
class ReverseActiveErrandHandler implements ICommandHandler<ReverseActiveErrandCommand> { async execute(command: ReverseActiveErrandCommand): Promise<void>; }

/** Command input for recording a successful client refund. */
class RecordClientRefundCommand extends Command<void> { constructor(public readonly clientUserId: UserId, public readonly walletId: WalletId, public readonly escrowId: EscrowId, public readonly amountKobo: number, public readonly currency: Currency, public readonly gatewayReference: string); }
/** Appends REFUND_CREDIT, updates snapshot, then publishes ClientRefunded. */
@CommandHandler(RecordClientRefundCommand)
class RecordClientRefundHandler implements ICommandHandler<RecordClientRefundCommand> { async execute(command: RecordClientRefundCommand): Promise<void>; }

/** Command input for replaying an externally successful payment whose ledger append failed. */
class AppendFailedLedgerEntryCommand extends Command<void> { constructor(public readonly payload: AppendFailedLedgerEntryPayload); }
/** Replays the append through the same idempotencyKey path, making duplicate replay naturally safe. */
@CommandHandler(AppendFailedLedgerEntryCommand)
class AppendFailedLedgerEntryHandler implements ICommandHandler<AppendFailedLedgerEntryCommand> { async execute(command: AppendFailedLedgerEntryCommand): Promise<void>; }

/** Query input for current wallet balances. */
class GetWalletBalancesQuery extends Query<WalletBalancesDTO> { constructor(public readonly userId: UserId); }
/** Reads WalletBalanceSnapshot; if missing or stale, rebuilds from LedgerEntry before returning DTO. */
@QueryHandler(GetWalletBalancesQuery)
class GetWalletBalancesHandler implements IQueryHandler<GetWalletBalancesQuery> { async execute(query: GetWalletBalancesQuery): Promise<WalletBalancesDTO>; }

/** Query input for paginated ledger history. */
class GetLedgerHistoryQuery extends Query<LedgerHistoryPageDTO> { constructor(public readonly userId: UserId, public readonly cursor: string | null, public readonly limit: number); }
/** Returns application DTOs for ledger history; never returns GraphQL types or Prisma rows. */
@QueryHandler(GetLedgerHistoryQuery)
class GetLedgerHistoryHandler implements IQueryHandler<GetLedgerHistoryQuery> { async execute(query: GetLedgerHistoryQuery): Promise<LedgerHistoryPageDTO>; }

/** DTO returned by GetWalletBalancesQuery. */
interface WalletBalancesDTO { activeKobo: number; pendingKobo: number; availableKobo: number; currency: Currency; }
/** DTO returned by GetLedgerHistoryQuery. */
interface LedgerHistoryPageDTO { entries: LedgerEntryDTO[]; nextCursor: string | null; }
/** User-facing ledger DTO with typed IDs retained in the application layer. */
interface LedgerEntryDTO { id: LedgerEntryId; type: LedgerEntryType; amountKobo: number; currency: Currency; escrowId: EscrowId | null; gatewayReference: string | null; createdAt: Date; }
```

### Application Jobs

```typescript
/** Payload for one reconciliation window. */
interface ReconcileLedgerPayload { windowStart: Date; windowEnd: Date; provider: 'paystack' | 'webhook-log'; cursor: string | null; correlationId: string; }

/** Scheduler/query side: partitions time into windows and enqueues one BullMQ reconciliation job per window. */
class ReconcileLedgerJob {
  /** Enqueues work by querying configured audit windows; it never compares records inline in the scheduler tick. */
  async enqueueDueJobs(windowStart: Date, windowEnd: Date): Promise<void>;
}

/** Processor that compares Paystack transaction API or stored webhook logs against LedgerEntry.gatewayReference. */
@Processor('wallet_reconcile_ledger')
class ReconcileLedgerProcessor {
  /** Detects missing, duplicate, and amount-mismatched ledger rows; publishes LedgerDiscrepancyDetected or writes the audit report after comparison. DLQ payload includes windowStart, windowEnd, provider, cursor, correlationId, and failure reason for replay. */
  async process(job: Job<ReconcileLedgerPayload>): Promise<void>;
}

/** Payload needed to safely append a ledger entry after an external payment succeeded but the ledger append failed. */
interface AppendFailedLedgerEntryPayload { walletId: WalletId; userId: UserId; ledgerEntryType: LedgerEntryType; amountKobo: number; currency: Currency; escrowId: EscrowId | null; gatewayReference: string; idempotencyKey: string; rawGatewayEventId: string; correlationId: string; }

/** Scheduler/query side for retrying failed ledger appends; enqueues one job per persisted failure record. */
class AppendFailedLedgerEntryJob {
  /** Enqueues failed append records without processing them inline. */
  async enqueueDueJobs(): Promise<void>;
}

/** BullMQ worker for replaying failed ledger appends through CommandBus. */
@Processor('wallet_append_failed_ledger_entry')
class AppendFailedLedgerEntryProcessor {
  /** Calls commandBus.execute(new AppendFailedLedgerEntryCommand(job.data)) with attempts=5 and exponential backoff. After retries, DLQ stores walletId, userId, ledgerEntryType, amountKobo, currency, escrowId, gatewayReference, idempotencyKey, rawGatewayEventId, correlationId, and failure reason; replay is safe because idempotencyKey is unique. */
  async process(job: Job<AppendFailedLedgerEntryPayload>): Promise<void>;
}
```

### Infrastructure And Presentation Layers

```typescript
/** Prisma implementation of IWalletRepository. */
@Injectable()
class PrismaWalletRepository implements IWalletRepository { async findById(id: WalletId): Promise<Wallet | null>; async findByUserId(userId: UserId): Promise<Wallet | null>; async save(wallet: Wallet): Promise<void>; }
/** Prisma implementation of ILedgerEntryRepository with idempotencyKey uniqueness handling. */
@Injectable()
class PrismaLedgerEntryRepository implements ILedgerEntryRepository { async append(entry: LedgerEntry): Promise<void>; async appendMany(entries: LedgerEntry[]): Promise<void>; async findByWalletId(walletId: WalletId, cursor: string | null, limit: number): Promise<LedgerEntry[]>; async findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>; }
/** Prisma implementation of wallet balance snapshots. */
@Injectable()
class PrismaWalletBalanceSnapshotRepository implements IWalletBalanceSnapshotRepository { async apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>; async findByWalletId(walletId: WalletId): Promise<WalletBalanceSnapshot | null>; async rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>; }
/** Injectable mapper for Wallet. */
@Injectable()
class WalletMapper { toDomain(row: unknown): Wallet; toPersistence(wallet: Wallet): unknown; }
/** Injectable mapper for LedgerEntry. */
@Injectable()
class LedgerEntryMapper { toDomain(row: unknown): LedgerEntry; toPersistence(entry: LedgerEntry): unknown; }
/** Injectable mapper for WalletBalanceSnapshot. */
@Injectable()
class WalletBalanceSnapshotMapper { toDomain(row: unknown): WalletBalanceSnapshot; toPersistence(snapshot: WalletBalanceSnapshot): unknown; }
/** Adapter for Paystack transaction audit queries used by ReconcileLedgerProcessor. */
@Injectable()
class PaystackLedgerAuditAdapter { fetchTransactions(windowStart: Date, windowEnd: Date, cursor: string | null): Promise<GatewayLedgerTransactionPage>; }

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class WalletResolver { constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus); }

/** GraphQL type for wallet balances; this is separate from WalletBalancesDTO. */
@ObjectType()
class WalletBalancesType implements WalletBalancesDTO { activeKobo: number; pendingKobo: number; availableKobo: number; currency: Currency; }
/** Explicit balance DTO to GraphQL conversion. */
function toWalletBalancesType(dto: WalletBalancesDTO): WalletBalancesType;

/** GraphQL shape overrides EntityId fields from LedgerEntryDTO. */
type LedgerEntryGraphQLShape = Omit<LedgerEntryDTO, 'id' | 'escrowId'> & { id: string; escrowId: string | null };
/** GraphQL type for ledger rows with EntityId values converted to strings. */
@ObjectType()
class LedgerEntryGraphQLType implements LedgerEntryGraphQLShape { id: string; type: LedgerEntryType; amountKobo: number; currency: Currency; escrowId: string | null; gatewayReference: string | null; createdAt: Date; }
/** Explicit ledger DTO to GraphQL conversion. */
function toLedgerEntryGraphQLType(dto: LedgerEntryDTO): LedgerEntryGraphQLType;

/** GraphQL shape for a ledger history page. */
type LedgerHistoryPageGraphQLShape = Omit<LedgerHistoryPageDTO, 'entries'> & { entries: LedgerEntryGraphQLType[] };
/** GraphQL type for paginated ledger history. */
@ObjectType()
class LedgerHistoryPageType implements LedgerHistoryPageGraphQLShape { entries: LedgerEntryGraphQLType[]; nextCursor: string | null; }
/** Explicit page DTO to GraphQL conversion. */
function toLedgerHistoryPageType(dto: LedgerHistoryPageDTO): LedgerHistoryPageType;
```

## EIP Patterns Applied

- **Event Sourcing / Append-Only Log**: `LedgerEntry` is the authoritative wallet history and every balance can be replayed. Status: fully specced with concrete signatures in the Implementation Spec.
- **Materialized View**: `WalletBalanceSnapshot` is updated synchronously after each successful ledger append through `walletBalanceSnapshotRepository.apply(walletId, entries)` and rebuilt on stale/missing reads. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: Every ledger append has an `idempotencyKey`; escrow flows key off `escrowId`, while `recordWithdrawal()` keys off `gatewayReference` because withdrawals are not escrow-bound. Status: fully specced with concrete signatures in the Implementation Spec.
- **Reconciliation / Audit**: `ReconcileLedgerJob` and `ReconcileLedgerProcessor` compare Paystack transactions or stored webhook logs against ledger rows by `gatewayReference` and report missing, duplicate, and amount-mismatched entries. Status: fully specced with concrete signatures in the Implementation Spec.
- **Dead Letter Channel**: `AppendFailedLedgerEntryJob` and `AppendFailedLedgerEntryProcessor` retry externally successful payment events whose ledger append failed; DLQ payloads include all fields needed for replay, and the unique idempotency key prevents double-crediting. Status: fully specced with concrete signatures in the Implementation Spec.
