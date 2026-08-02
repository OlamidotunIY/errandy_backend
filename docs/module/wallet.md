# Module: wallet

## Folder placement

```
src/modules/wallet/
├── domain/
│   ├── entities/
│   │   ├── wallet.entity.ts
│   │   ├── ledger.entity.ts
│   │   ├── withdrawal.entity.ts
│   │   └── bank-account.entity.ts
│   ├── repositories/
│   │   ├── wallet.repository.interface.ts
│   │   ├── ledger.repository.interface.ts
│   │   ├── withdrawal.repository.interface.ts
│   │   └── bank-account.repository.interface.ts
│   ├── events/
│   │   ├── wallet-credited.event.ts
│   │   ├── wallet-debited.event.ts
│   │   ├── withdrawal-requested.event.ts
│   │   ├── withdrawal-completed.event.ts
│   │   ├── withdrawal-failed.event.ts
│   │   ├── bank-account-added.event.ts
│   │   ├── bank-account-verified.event.ts
│   │   └── bank-account-verification-failed.event.ts
│   └── errors/
│       ├── insufficient-balance.error.ts
│       ├── wallet-not-found.error.ts
│       ├── withdrawal-not-found.error.ts
│       ├── bank-account-not-found.error.ts
│       ├── bank-account-not-verified.error.ts
│       └── bank-account-market-mismatch.error.ts
├── application/
│   ├── commands/
│   │   ├── request-withdrawal/
│   │   ├── add-bank-account/
│   │   ├── remove-bank-account/
│   │   ├── set-default-bank-account/
│   │   ├── verify-bank-account/               (internal — dispatched only by the resolution processor)
│   │   └── mark-bank-account-verification-failed/
│   ├── event-handlers/
│   │   ├── on-escrow-released.handler.ts      (payout split → one or more Wallet.credit() calls)
│   │   ├── on-transfer-succeeded.handler.ts    (bridge — enqueues withdrawal-continue job)
│   │   └── on-transfer-failed.handler.ts       (bridge)
│   ├── processors/
│   │   ├── withdrawal-continue.processor.ts
│   │   └── bank-account-resolution.processor.ts
│   ├── jobs/
│   │   ├── ledger-reconciliation.job.ts
│   │   └── stuck-withdrawal-sweep.job.ts       (default threshold: 6h in PENDING)
│   └── queries/
│       ├── get-wallet-balance/
│       └── list-ledger-entries/
├── infrastructure/
│   ├── adapters/
│   │   ├── bank-transfer.adapter.ts
│   │   └── bank-account-resolver.adapter.ts
│   ├── mappers/
│   │   ├── wallet.mapper.ts
│   │   ├── ledger.mapper.ts
│   │   ├── withdrawal.mapper.ts
│   │   └── bank-account.mapper.ts
│   └── repositories/
│       ├── wallet.repository.ts
│       ├── ledger.repository.ts
│       ├── withdrawal.repository.ts
│       └── bank-account.repository.ts
└── wallet.module.ts
```

## Prisma schema

```prisma
model Wallet {
  id                 String   @id @default(auto()) @map("_id") @db.ObjectId
  ownerId            String   @unique @db.ObjectId   // Party — plain scalar
  marketId           String   @db.ObjectId
  balanceMinorUnits  Int      @default(0)             // cached — Ledger is the source of truth
}

model Ledger {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  walletId      String   @db.ObjectId
  type          String   // CREDIT | DEBIT
  amountMinorUnits Int
  referenceType String   // ESCROW_RELEASE | WITHDRAWAL | WITHDRAWAL_REVERSAL
  referenceId   String   @db.ObjectId
  createdAt     DateTime @default(now())

  @@index([walletId])
}

model Withdrawal {
  id                       String    @id @default(auto()) @map("_id") @db.ObjectId
  walletId                 String    @db.ObjectId
  amount                   Money
  status                   String    @default("PENDING")   // PENDING | COMPLETED | FAILED
  destinationBankAccountId String    @db.ObjectId
  gatewayReference         String?
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@index([status, createdAt])   // supports StuckWithdrawalSweepJob's threshold scan
}

model BankAccount {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  ownerId       String   @db.ObjectId   // Party — plain scalar
  marketId      String   @db.ObjectId
  bankCode      String
  accountNumber String
  accountName   String?  // resolved via gateway, null until BankAccountResolutionProcessor confirms
  isVerified    Boolean  @default(false)
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## Domain entity methods

**`Wallet`**
- `credit(amountMinorUnits, referenceType, referenceId)` — writes a `Ledger` row, increments cached balance
- `debit(amountMinorUnits, referenceType, referenceId)` — throws `InsufficientBalanceError` if `balanceMinorUnits < amount`; writes `Ledger`, decrements cached balance

**`Withdrawal`**
- `request()` → `PENDING`
- `markCompleted()` → `COMPLETED`
- `markFailed(reason)` → `FAILED`

**`BankAccount`**
- `create(ownerId, marketId, bankCode, accountNumber)` — `isVerified: false`
- `markVerified(accountName)`
- `markVerificationFailed()`
- `setDefault()`

## Repository interfaces

```typescript
abstract class IWalletRepository {
  abstract save(wallet: Wallet): Promise<void>;
  abstract findById(id: string): Promise<Wallet | null>;
  abstract findByOwnerId(ownerId: string): Promise<Wallet | null>;
}
abstract class ILedgerRepository {
  abstract save(entry: Ledger): Promise<void>;
  abstract findByWalletId(walletId: string): Promise<Ledger[]>;
  abstract sumByWalletId(walletId: string): Promise<number>;   // used by LedgerReconciliationJob
}
abstract class IWithdrawalRepository {
  abstract save(withdrawal: Withdrawal): Promise<void>;
  abstract findById(id: string): Promise<Withdrawal | null>;
  abstract findPendingOlderThan(threshold: Date): Promise<Withdrawal[]>;
}
abstract class IBankAccountRepository {
  abstract save(account: BankAccount): Promise<void>;
  abstract findById(id: string): Promise<BankAccount | null>;
  abstract findByOwnerId(ownerId: string): Promise<BankAccount[]>;
}
```

## Shared utility — proportional payout split

Not specific to this module's persistence layer, but used by `on-escrow-released.handler.ts` — worth placing in a shared library (`src/common/split-proportionally.ts`) since the rounding problem recurs anywhere a `Money` amount needs dividing.

```typescript
function splitProportionally(totalMinorUnits: number, weights: number[]): number[] {
  // Largest Remainder Method — guarantees the output sums exactly to totalMinorUnits, no rounding drift
}
```

## DTOs

```typescript
// commands/request-withdrawal/request-withdrawal.request.dto.ts
interface RequestWithdrawalRequestDto {
  walletId: string;
  amountMinorUnits: number;
  destinationBankAccountId: string;
}
interface RequestWithdrawalResponseDto {
  withdrawalId: string;
  status: 'PENDING';
}

// commands/add-bank-account/add-bank-account.request.dto.ts
interface AddBankAccountRequestDto {
  ownerId: string;
  bankCode: string;
  accountNumber: string;
}
interface AddBankAccountResponseDto {
  bankAccountId: string;
  isVerified: false;   // always false at creation — verified async
}

// queries/get-wallet-balance/get-wallet-balance.response.dto.ts
interface WalletBalanceResponseDto {
  walletId: string;
  balanceMinorUnits: number;
  currency: string;
}

// queries/list-ledger-entries/list-ledger-entries.response.dto.ts
interface LedgerEntryResponseDto {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amountMinorUnits: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}
```

## Open items

- Bank account re-verification trigger after a withdrawal failure suggesting bad details — not decided (carried from `docs/flows/withdrawal-flow.md`).
