# Module: wallet

## Revision note

`Withdrawal` as a separate status-tracking entity has been **removed**. "Is this transfer still pending with the gateway" is `payment-gateway`'s concern (it already owns `PaymentTransaction` for charges — a sibling `Transfer` entity, or `PaymentTransaction` with a `direction: CHARGE|TRANSFER` field, plays the same role for payouts). Wallet only needs to know: debit now, reverse later if the gateway reports failure. `StuckWithdrawalSweepJob` moves to `payment-gateway` accordingly.

Adopted the three-tier balance model (`ACTIVE_ERRAND` / `PENDING` / `AVAILABLE`) plus the sequence-based optimistic-concurrency ledger, both meaningfully better than what was here before — explained below.

## Folder placement

```
src/modules/wallet/
├── domain/
│   ├── entities/
│   │   ├── wallet.entity.ts
│   │   ├── ledger-entry.entity.ts
│   │   ├── wallet-balance-snapshot.entity.ts
│   │   └── bank-account.entity.ts
│   ├── value-objects/
│   │   └── ledger-entry-type.vo.ts
│   ├── repositories/
│   │   ├── wallet.repository.interface.ts
│   │   ├── ledger-entry.repository.interface.ts
│   │   ├── wallet-balance-snapshot.repository.interface.ts
│   │   └── bank-account.repository.interface.ts
│   ├── events/
│   │   ├── ledger-entry-recorded.event.ts
│   │   ├── bank-account-added.event.ts
│   │   ├── bank-account-verified.event.ts
│   │   └── bank-account-verification-failed.event.ts
│   └── errors/
│       ├── wallet-already-exists.error.ts
│       ├── wallet-not-found.error.ts
│       ├── duplicate-ledger-entry.error.ts
│       ├── insufficient-balance.error.ts
│       ├── sequence-conflict.error.ts          (optimistic-concurrency guard)
│       ├── bank-account-not-found.error.ts
│       ├── bank-account-not-verified.error.ts
│       └── bank-account-currency-mismatch.error.ts
├── application/
│   ├── commands/
│   │   ├── request-withdrawal/
│   │   ├── release-to-pending/          (internal — dispatched by OnEscrowReleasedHandler)
│   │   ├── move-pending-to-available/   (internal — dispatched by the window-expiry job)
│   │   ├── reverse-pending/             (internal — dispatched by DisputeResolutionSaga when resolution lands in the window)
│   │   ├── add-bank-account/
│   │   ├── remove-bank-account/
│   │   ├── set-default-bank-account/
│   │   └── verify-bank-account/          (internal — processor-only)
│   ├── event-handlers/
│   │   ├── on-escrow-released.handler.ts
│   │   └── on-transfer-failed.handler.ts    (bridge → enqueues reversal job)
│   ├── processors/
│   │   ├── withdrawal-reversal.processor.ts
│   │   └── bank-account-resolution.processor.ts
│   ├── jobs/
│   │   ├── release-pending-window.job.ts    (moves PENDING → AVAILABLE once the 7-day window elapses undisputed)
│   │   └── ledger-reconciliation.job.ts     (verifies snapshot buckets against summed LedgerEntry rows)
│   └── queries/
│       ├── get-wallet-balance/
│       └── list-ledger-entries/
├── infrastructure/
│   ├── adapters/
│   │   └── bank-account-resolver.adapter.ts
│   ├── mappers/
│   │   ├── wallet.mapper.ts
│   │   ├── ledger-entry.mapper.ts
│   │   ├── wallet-balance-snapshot.mapper.ts
│   │   └── bank-account.mapper.ts
│   └── repositories/
│       ├── wallet.repository.ts
│       ├── ledger-entry.repository.ts
│       ├── wallet-balance-snapshot.repository.ts
│       └── bank-account.repository.ts
└── wallet.module.ts
```

## Prisma schema

```prisma
model Wallet {
  id        String   @id @map("_id") @db.ObjectId
  partyId   String   @unique @db.ObjectId   // Party, not userId — organizations need their own withdrawable wallet too
  currency  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum LedgerEntryType {
  ACTIVE_ERRAND_CREDIT      // accrual — claim recorded once assigned/started, before real funds move
  ACTIVE_ERRAND_REVERSAL    // removes the accrual once escrow actually releases
  PENDING_CREDIT            // real funds, just released from escrow, held during the dispute grace window
  PENDING_REVERSAL          // window elapsed without dispute (paired with AVAILABLE_CREDIT) OR a dispute resolved against the party (unpaired)
  AVAILABLE_CREDIT          // now withdrawable
  WITHDRAWAL_DEBIT
  REFUND_CREDIT             // compensating entry if a withdrawal transfer fails after debit
  COMPENSATION_CREDIT       // admin-issued, e.g. resolving a FailedRefund via COMPENSATE_WALLET rather than a gateway retry
}

model LedgerEntry {
  id               String          @id @map("_id") @db.ObjectId
  walletId         String          @db.ObjectId
  partyId          String          @db.ObjectId
  type             LedgerEntryType
  amountMinorUnits Int
  currency         String
  escrowId         String?         @db.ObjectId
  gatewayReference String?
  idempotencyKey   String
  sequence         Int             // monotonic per wallet — see WalletLedgerSequence
  metadata         Json?
  createdAt        DateTime        @default(now())

  @@index([walletId, createdAt])
  @@index([escrowId])
  @@index([gatewayReference])
  @@unique([idempotencyKey])
}

model WalletBalanceSnapshot {
  id                  String   @id @map("_id") @db.ObjectId
  walletId            String   @unique @db.ObjectId
  activeErrandBalance Int      @default(0)
  pendingBalance      Int      @default(0)
  availableBalance    Int      @default(0)
  lastSequence        Int      @default(0)   // monotonic counter, not a timestamp — backs optimistic concurrency
  updatedAt           DateTime @updatedAt
}

model WalletLedgerSequence {
  id       String @id @map("_id") @db.ObjectId
  walletId String @unique @db.ObjectId
  sequence Int    @default(0)
}

model BankAccount {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  ownerId       String   @db.ObjectId   // Party
  currency      String   // aligned with Wallet — was marketId
  bankCode      String
  accountNumber String
  accountName   String?
  isVerified    Boolean  @default(false)
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## The bucket-transfer model, explained

Money moves through buckets as paired entries (a reversal from one bucket + a credit to the next), never as an isolated credit — this keeps every transition auditable as a real double-entry-style movement, not just an isolated balance bump:

1. **`ErrandStarted`** (not `ErrandAssigned` — resolved: the accrual represents "actively being worked," which only becomes true once work begins, not merely once someone's been matched) → `ACTIVE_ERRAND_CREDIT` (accrual — "this is expected once the job completes"; the real money is still sitting in `Escrow`, this is a claim, not a fund movement)
2. **`ErrandCompleted` → `EscrowReleased`** → `ACTIVE_ERRAND_REVERSAL` + `PENDING_CREDIT` (accrual clears, real funds arrive but held for the dispute window)
3. **Window elapses, no dispute** (`ReleasePendingWindowJob`) → `PENDING_REVERSAL` + `AVAILABLE_CREDIT`
4. **Dispute resolved against the party, within the window** → `PENDING_REVERSAL` only, no `AVAILABLE_CREDIT` — see the dispute-window alignment note below
5. **`RequestWithdrawalCommand`** → `WITHDRAWAL_DEBIT` (from `availableBalance`)
6. **Transfer fails** → `REFUND_CREDIT` (reverses the debit)

## Optimistic concurrency

`WalletBalanceSnapshot.lastSequence` + `WalletLedgerSequence` prevent two concurrent credits to the same wallet (e.g. two errands completing simultaneously for the same provider) from corrupting the balance — each `LedgerEntry` write increments `WalletLedgerSequence` and is only applied to the snapshot if `entry.sequence == snapshot.lastSequence + 1`; a mismatch throws `SequenceConflictError` and the caller retries. This is a meaningfully stronger guarantee than my earlier "cached balance, reconciled nightly" design — reconciliation only catches drift *after* it happens, this prevents the race in the first place.

## Domain entity methods

**`LedgerEntry`** — `record(walletId, partyId, type, amountMinorUnits, currency, idempotencyKey, escrowId?, gatewayReference?, metadata?)` — throws `DuplicateLedgerEntryError` on a repeated `idempotencyKey` (schema-enforced too, via `@@unique`)

**`WalletBalanceSnapshot`** — `applyEntry(entry: LedgerEntry)` — routes to the correct bucket(s) per `entry.type`, guarded by the sequence check above

**`BankAccount`** — unchanged from before, aside from `currency` replacing `marketId`

## Platform fee (20%, 0% on a party's first payout)

**Correctness note**: fee eligibility is deliberately checked against `wallet`'s own `LedgerEntry` history, not `ProviderRole.completedErrandsCount` on `party` — that counter is updated by an independent listener reacting to the same `ErrandCompleted` event, with no ordering guarantee relative to the payout calculation. Keeping the check inside this module's own data avoids the race entirely.

```typescript
class PlatformFeePolicy {
  constructor(private readonly ledgerRepo: ILedgerEntryRepository) {}

  async computeFeeBasisPoints(walletId: string): Promise<number> {
    const hasPriorPayout = await this.ledgerRepo.existsByWalletIdAndType(walletId, 'PENDING_CREDIT');
    return hasPriorPayout ? 2000 : 0;   // 20% standard, 0% for a wallet's first-ever payout
  }
}
```

Applied **once per errand payout**, against the applicant's wallet (individual or org — never per-individual-worker), before the existing `workerPoolPercentage`/`splitPercentage` division runs on what's left:

```
total = escrow.amountMinorUnits
feeBasisPoints = await platformFeePolicy.computeFeeBasisPoints(applicantWalletId)
[platformFee, netAmount] = Money.fromMinorUnits(total, currency).splitFee(feeBasisPoints)
record PlatformRevenueEntry(platformFee)
// netAmount then proceeds through the existing org/worker split, unchanged
```

```prisma
model PlatformRevenueEntry {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  errandId         String   @db.ObjectId
  sourceWalletId   String   @db.ObjectId
  amountMinorUnits Int
  currency         String
  feeBasisPoints   Int
  createdAt        DateTime @default(now())
}
```

## Repository interfaces

```typescript
abstract class IWalletRepository {
  abstract save(wallet: Wallet): Promise<void>;
  abstract findById(id: string): Promise<Wallet | null>;
  abstract findByPartyId(partyId: string): Promise<Wallet | null>;
}
abstract class ILedgerEntryRepository {
  abstract record(entry: LedgerEntry): Promise<void>;   // enforces idempotencyKey uniqueness
  abstract findByWalletId(walletId: string, pagination: { limit: number; cursor?: string }): Promise<{ items: LedgerEntry[]; nextCursor?: string }>;
  abstract findByEscrowId(escrowId: string): Promise<LedgerEntry[]>;
  abstract findByGatewayReference(reference: string): Promise<LedgerEntry | null>;
}
abstract class IWalletBalanceSnapshotRepository {
  abstract save(snapshot: WalletBalanceSnapshot): Promise<void>;   // must check lastSequence — throws SequenceConflictError on mismatch
  abstract findByWalletId(walletId: string): Promise<WalletBalanceSnapshot | null>;
}
abstract class IBankAccountRepository {
  abstract save(account: BankAccount): Promise<void>;
  abstract findById(id: string): Promise<BankAccount | null>;
  abstract findByOwnerId(ownerId: string): Promise<BankAccount[]>;
}
```

## Shared utility — proportional payout split

```typescript
// src/common/split-proportionally.ts — or just Money.split(), see money.entity.ts
```

## Events

| Event | Raised by | Payload |
|---|---|---|
| `LedgerEntryRecorded` | `LedgerEntry.record()` | `{ ledgerEntryId, walletId, type, amountMinorUnits, correlationId }` |
| `BankAccountAdded` | `BankAccount.create()` | `{ bankAccountId, ownerId, correlationId }` |
| `BankAccountVerified` | `BankAccount.markVerified()` | `{ bankAccountId, correlationId }` |
| `BankAccountVerificationFailed` | `BankAccount.markVerificationFailed()` | `{ bankAccountId, reason, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `RequestWithdrawalCommand` | Validates `bankAccount.isVerified` and `bankAccount.currency === wallet.currency`. Writes `WITHDRAWAL_DEBIT` immediately, then dispatches `InitiateTransferCommand` into `payment-gateway`. |
| `ReleaseToPendingCommand` | Internal — `ACTIVE_ERRAND_REVERSAL` + `PENDING_CREDIT`, schedules the window-expiry job. |
| `MovePendingToAvailableCommand` | Internal — dispatched by `ReleasePendingWindowJob`. |
| `ReversePendingCommand` | Internal — dispatched by `DisputeResolutionSaga` when resolution lands within the window. |
| `AddBankAccountCommand` / `RemoveBankAccountCommand` / `SetDefaultBankAccountCommand` | As before, `currency` in place of `marketId`. |
| `VerifyBankAccountCommand` | Internal — processor-only. |

## Event Handlers

| Handler | Listens for | Does |
|---|---|---|
| `OnEscrowReleasedHandler` | `EscrowReleased` | Computes the payout split (`Money.split()`), dispatches `ReleaseToPendingCommand` per recipient |
| `OnTransferFailedHandler` | `TransferFailed` (from `payment-gateway`) | Bridge — enqueues the reversal job |

## Jobs

| Job | Schedule | Does |
|---|---|---|
| `ReleasePendingWindowJob` | Delayed 7 days (default, tunable), scheduled per-entry on `PENDING_CREDIT` | Dispatches `MovePendingToAvailableCommand` if no dispute intervened |
| `LedgerReconciliationJob` | Nightly | Verifies snapshot buckets against summed `LedgerEntry` rows |

## DTOs

```typescript
// commands/request-withdrawal/request-withdrawal.request.dto.ts
interface RequestWithdrawalRequestDto {
  walletId: string;
  amountMinorUnits: number;
  destinationBankAccountId: string;
}
interface RequestWithdrawalResponseDto {
  ledgerEntryId: string;
}

// commands/add-bank-account/add-bank-account.request.dto.ts
interface AddBankAccountRequestDto {
  ownerId: string;
  bankCode: string;
  accountNumber: string;
}
interface AddBankAccountResponseDto {
  bankAccountId: string;
  isVerified: false;
}

// queries/get-wallet-balance/get-wallet-balance.response.dto.ts
interface WalletBalanceResponseDto {
  walletId: string;
  currency: string;
  activeErrandBalance: number;
  pendingBalance: number;
  availableBalance: number;
}

// queries/list-ledger-entries/list-ledger-entries.response.dto.ts
interface LedgerEntryResponseDto {
  id: string;
  type: string;
  amountMinorUnits: number;
  escrowId: string | null;
  createdAt: string;
}
```

## Mappers

`WalletMapper`, `LedgerEntryMapper`, `WalletBalanceSnapshotMapper`, `BankAccountMapper` — thin, `Money`/currency conversions where applicable.

## Presentation

```graphql
type Mutation {
  requestWithdrawal(input: RequestWithdrawalInput!): RequestWithdrawalResult! @auth
  addBankAccount(input: AddBankAccountInput!): AddBankAccountResult! @auth
  removeBankAccount(bankAccountId: ID!): Boolean! @auth
  setDefaultBankAccount(bankAccountId: ID!): BankAccount! @auth
}
type Query {
  walletBalance: WalletBalance! @auth
  ledgerEntries(limit: Int!, cursor: String): [LedgerEntry!]! @auth
}
```

## Open items

- Bank account re-verification trigger: **resolved** — if a withdrawal failure's reason indicates invalid account details specifically (a known gateway error code), `BankAccount.isVerified` is automatically reset to `false`, forcing re-verification before the next attempt. Other failure reasons (e.g. a transient gateway outage) leave verification status untouched.
