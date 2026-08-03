# Flow: Payment Method Verification (with Failed-Refund Tracking)

## Actors

- **Party** with `ClientRole` — adding a payment method
- **payment-gateway module** — owns `PaymentMethod`, the verification charge, and `FailedRefund`

## Why a small charge, not just a token check

A gateway token alone doesn't prove the card is actually chargeable (insufficient funds, blocked card, etc.) — a real small charge (e.g. ₦50) that succeeds is the actual proof. It's then refunded as a courtesy, since the point was verification, not revenue.

## Step-by-step sequence

1. `AddPaymentMethodCommand { partyId, gatewayToken }` → `PaymentMethod { isVerified: false }` saved
2. Fresh `correlationId`. Dispatches `InitiateChargeCommand { clientId: partyId, purposeId: paymentMethodId, amount: verificationAmount, correlationId }` — `purposeId` is the `paymentMethodId`, consistent with the no-`purposeType` convention established for the accept-flow (relevance is resolved by checking whether `purposeId` matches an unverified `PaymentMethod`, not a type tag)
3. **Async gateway confirmation** — webhook fires, `PaymentSucceeded`/`PaymentFailed`
4. **`PaymentSucceeded`** → `OnVerificationPaymentSucceededHandler` — **thin bridge only**, checks `purposeId` against an unverified `PaymentMethod`, enqueues a `charge-succeeded` job onto the `payment-method-verification` queue *(Competing Consumers)*. No business logic in the handler itself — same reasoning as the accept-flow and withdrawal: this is money-adjacent async work, a plain handler throwing would silently drop it.
5. `PaymentMethodVerificationProcessor` dispatches `MarkPaymentMethodVerifiedCommand` → **`PaymentMethod.markVerified()` happens here.** The charge succeeding *is* the verification signal; nothing about the refund's outcome affects this. Same command handler then dispatches `RefundPaymentCommand { paymentTransactionId, correlationId }`.
6. **On `PaymentFailed`** (the verification charge itself failed, not the refund): the card simply isn't verified — no `FailedRefund` involved, this is the normal "bad card" case, handled by a plain `@EventsHandler` (not money-critical the same way — nothing was ever debited). `PaymentMethod` stays `isVerified: false`; user notified to try a different card.
7. **Refund outcome, async again** (a second webhook round-trip): `OnVerificationRefundOutcomeHandler` — thin bridge, success is a no-op (nothing to enqueue), failure enqueues a `refund-failed` job.
8. `PaymentMethodVerificationProcessor` (same processor, second job name) dispatches `RecordFailedRefundCommand` → `FailedRefund.record(paymentTransactionId, partyId, amountMinorUnits, currency, reason)` — dead-lettered via `IDeadLetterRepository` if this itself fails permanently, per the standard processor pattern.
9. `FailedRefund` sits in `PENDING_MANUAL_REVIEW` until an admin calls `ResolveFailedRefundCommand { failedRefundId, resolvedById }` — the actual resolution mechanism (retry the gateway refund vs. issue a wallet credit as compensation) isn't decided yet, just the tracking that makes it visible and actionable rather than lost.

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `PaymentSucceeded` (verification charge) | `payment-gateway` | `{ paymentTransactionId, purposeId, amountMinorUnits, correlationId }` | `OnVerificationChargeSucceededHandler` |
| `PaymentFailed` (verification charge) | `payment-gateway` | `{ paymentTransactionId, purposeId, reason, correlationId }` | Notification |
| `PaymentRefunded` | `payment-gateway` | `{ paymentTransactionId, correlationId }` | Notification |
| `PaymentFailed` (refund attempt) | `payment-gateway` | `{ paymentTransactionId, purposeId, reason, correlationId }` | `OnVerificationRefundFailedHandler` |

Note the two different `PaymentFailed` occurrences above share the same event shape but very different meanings depending on *which* transaction failed (the original charge vs. the refund) — the handler distinguishes them by looking up `paymentTransactionId`'s own `direction`/history, not by anything in the event payload itself. Worth being careful about this ambiguity in the actual handler implementation.

## Algorithmic component

None.

## Open items

- **Verification amount: resolved** — configurable per `Market` (a new `verificationChargeAmountMinorUnits` field on the `Market` seed data), rather than a single hardcoded figure, since a nominal amount in one currency isn't automatically nominal in another.
- **`ResolveFailedRefundCommand`'s mechanism: resolved** — takes a `resolution: RETRY_REFUND | COMPENSATE_WALLET` param. `RETRY_REFUND` re-attempts the gateway refund call. `COMPENSATE_WALLET` credits the party's wallet directly with a new `LedgerEntryType.COMPENSATION_CREDIT` entry (bypassing the gateway entirely) — the admin's judgment call on which is appropriate given the specific failure reason.
- **Rate limiting: resolved** — max 3 `AddPaymentMethodCommand` calls per party per rolling 24 hours, enforced in the handler via a simple counter check (not a full rate-limit adapter) against recent `PaymentMethod` creation timestamps for that `partyId`.
