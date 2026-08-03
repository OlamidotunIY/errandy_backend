# Flow: Withdrawal (Debit-First, Compensating Credit)

## Revision note

`Withdrawal` as a separate status-tracking entity is gone (see `docs/modules/wallet.md`'s revision note). "Is this transfer still pending" now lives in `payment-gateway`'s `PaymentTransaction` (via `direction: TRANSFER`), the same entity that already tracked charges. Wallet's role is now just: debit the ledger immediately, react to the eventual `TransferSucceeded`/`TransferFailed`.

## Actors

- **Party** (worker/org, requesting payout)
- **wallet module** — owns `LedgerEntry`, `WalletBalanceSnapshot`, `BankAccount`
- **payment-gateway module** — owns the transfer's external status end-to-end

## Preconditions

- `bankAccount.isVerified === true`
- `bankAccount.currency === wallet.currency` — no NGN wallet paying out to a GHS account, structurally enforced (aligned with `Wallet`'s currency-based matching, not `marketId`)
- `wallet.availableBalance >= requestedAmount` — checked against the snapshot's `availableBalance` bucket specifically, not the total across all three buckets

## Step-by-step sequence

1. `RequestWithdrawalCommand { walletId, amountMinorUnits, destinationBankAccountId }`
2. Fresh `correlationId` — new top-level transaction
3. **Debits immediately** — the deliberate design choice from earlier in this project, to prevent a double-withdrawal race: `LedgerEntry.record({ type: WITHDRAWAL_DEBIT, ... })`, applied to `WalletBalanceSnapshot.availableBalance` via the sequence-guarded `applyEntry()` (see `docs/modules/wallet.md` for the optimistic-concurrency mechanism)
4. `LedgerEntryRecorded { ledgerEntryId, walletId, type: WITHDRAWAL_DEBIT, amountMinorUnits, correlationId }`
5. Dispatches `InitiateTransferCommand { recipientPartyId, purposeId: ledgerEntryId, amount, destinationBankAccountId, correlationId }` into `payment-gateway` — `purposeId` is the `LedgerEntry`'s own id, giving the eventual webhook response something to correlate back to
6. **Async gateway confirmation** — `payment-gateway`'s webhook controller receives the callback, calls `PaymentTransaction.markSucceeded()`/`markFailed()`, raises `TransferSucceeded`/`TransferFailed`
7. `wallet`'s `OnTransferFailedHandler` (bridge, no business logic) enqueues a job onto `withdrawal-reversal` — *(Competing Consumers)*. **No handler is needed for `TransferSucceeded`** — nothing further happens in `wallet` on success, the debit simply stands.
8. `WithdrawalReversalProcessor` dispatches `ReverseWithdrawalCommand` → `LedgerEntry.record({ type: REFUND_CREDIT, ... })`, reversing the original debit. **No auto-retry** — the user is notified their withdrawal failed (with `reason`) and must manually re-initiate a fresh `RequestWithdrawalCommand` if they want to try again; that's a brand-new transaction with its own `correlationId`.
9. Permanent gateway failures are dead-lettered via `IDeadLetterRepository`; transient ones retry via BullMQ backoff

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `LedgerEntryRecorded` (`WITHDRAWAL_DEBIT`) | `wallet` | `{ ledgerEntryId, walletId, type, amountMinorUnits, correlationId }` | Notification |
| `TransferSucceeded` | `payment-gateway` | `{ paymentTransactionId, purposeId, correlationId }` | Notification only — wallet does nothing further |
| `TransferFailed` | `payment-gateway` | `{ paymentTransactionId, purposeId, reason, correlationId }` | `wallet` (bridge → reversal), Notification |
| `LedgerEntryRecorded` (`REFUND_CREDIT`, compensating) | `wallet` | `{ ledgerEntryId, walletId, type, amountMinorUnits, correlationId }` | Notification |

## `StuckTransferSweepJob`

Moved to `payment-gateway` (was `wallet`'s `StuckWithdrawalSweepJob`) — "stuck" = `direction: TRANSFER`, `status: PENDING` past 6h (default, tunable). Flags for ops review, does not auto-resolve.

## Algorithmic component

None — orchestration and compensation logic, not a computational problem.

## Open items

- Bank account re-verification trigger after a withdrawal failure suggesting bad details — not decided.
- Whether `TransferSucceeded` should still trigger *any* wallet-side event (e.g. for audit-log completeness) even though no state changes — currently designed as a pure no-op on success, worth confirming that's intentional rather than an oversight.
