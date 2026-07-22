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

## 10. Migration Risk & Priority

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
