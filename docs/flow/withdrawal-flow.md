# Flow: Withdrawal (Debit-First, Compensating Credit)

## Actors

- **Profile** (worker/org, requesting payout)
- **wallet module** — owns `Wallet`, `Ledger`, `Withdrawal`, `BankAccount`
- **payment-gateway module** — external transfer execution

## Why this is a genuine Process Manager, not a thin saga

Real money moves in a specific order with a hard failure branch, and a mid-flight crash (debited, but transfer never confirmed) would leave a bad state — same criteria as `AcceptApplicationProcessManager`. This one keeps persisted progress.

## Preconditions

- `bankAccount.isVerified === true` (see `verification`-adjacent `BankAccountResolutionProcessor` — added async, not blocking at add-time)
- `bankAccount.marketId === wallet.marketId` — no NGN wallet paying out to a GHS account, structurally enforced
- `wallet.balanceMinorUnits >= requestedAmount` (checked against the cached balance, immediately re-verified via `Ledger` sum if there's any doubt about drift)

## Step-by-step sequence

1. `RequestWithdrawalCommand { walletId, amountMinorUnits, destinationBankAccountId }`
2. Fresh `correlationId` — this is a new top-level transaction
3. `WithdrawalProcessManager.start()`:
   - Creates `Withdrawal { status: PENDING }`
   - **Debits immediately** — `Wallet.debit()` + `Ledger { type: DEBIT, referenceType: WITHDRAWAL, referenceId: withdrawalId }` — this is the deliberate design choice from earlier in this project: debiting at request-time, not at completion-time, specifically to prevent a double-withdrawal race (two requests both reading the same "available" balance before either completes)
   - `WalletDebited { walletId, amountMinorUnits, referenceId: withdrawalId, correlationId }`
   - `WithdrawalRequested { withdrawalId, walletId, amountMinorUnits, correlationId }`
   - Dispatches the actual transfer call into `payment-gateway`
4. **Async gateway confirmation** — same shape as the payment-charge flow: a webhook fires later, `payment-gateway` raises `TransferSucceeded`/`TransferFailed`
5. Bridge event handlers in `wallet` enqueue a job onto `withdrawal-continue` (Competing Consumers, same BullMQ pattern as `accept-application-continue`)
6. `WithdrawalContinueProcessor` dispatches the matching command:
   - **Success** → `WithdrawalCompleted { withdrawalId, correlationId }`, `Withdrawal.status: COMPLETED` — nothing further to compensate, the earlier debit stands
   - **Failure** → `WithdrawalFailed { withdrawalId, reason, correlationId }` **and** a compensating `Wallet.credit()` + `Ledger { type: CREDIT, referenceType: WITHDRAWAL_REVERSAL, referenceId: withdrawalId }`, raising `WalletCredited { ..., correlationId }` — same `correlationId` throughout, since this is still the same transaction unwinding, not a new one. **No auto-retry** — the user is simply notified their withdrawal failed (with `reason`) and must manually re-initiate a fresh `RequestWithdrawalCommand` if they want to try again; that's a brand-new transaction with its own `correlationId`, not a continuation of the failed one.
7. Permanent gateway failures (bad account details, etc.) are dead-lettered via `IDeadLetterRepository`, same classifier pattern as `ReleaseMaturedEscrowsProcessor`; transient ones retry via BullMQ backoff

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `WalletDebited` | `wallet` | `{ walletId, amountMinorUnits, referenceId, correlationId }` | Notification |
| `WithdrawalRequested` | `wallet` | `{ withdrawalId, walletId, amountMinorUnits, correlationId }` | Notification |
| `WithdrawalCompleted` | `wallet` | `{ withdrawalId, correlationId }` | Notification |
| `WithdrawalFailed` | `wallet` | `{ withdrawalId, reason, correlationId }` | Notification |
| `WalletCredited` (compensating) | `wallet` | `{ walletId, amountMinorUnits, referenceId: withdrawalId, correlationId }` | Notification |

## Algorithmic component

None — this is orchestration and compensation logic, not a computational problem.

## `StuckWithdrawalSweepJob`

"Stuck" = `Withdrawal.status: PENDING` for longer than a configurable threshold (default proposed: 6 hours — gateway transfers typically resolve in minutes, so this is generous headroom before flagging for manual ops review, not a hard technical limit). Sweeps and surfaces these for support to investigate — it doesn't retry or auto-resolve them itself, just flags.

## Open items

- Does a failed withdrawal's `BankAccount` get flagged for re-verification if the failure reason suggests bad account details, or is that left entirely to the user to notice and fix on their next attempt? Not yet decided.
