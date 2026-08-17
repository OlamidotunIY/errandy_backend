# Flow: Application/Errand Cancellation (Pre-Start Only)

This resolves the last major deferred item in the project, and closes out three things that were blocked on it: `NoShowDetectionJob`, `EscrowRefundSaga`, and `relistedFromErrandId` (unused since the very first version of the `Errand` model).

## Boundary — this only covers pre-start cancellation

`Application.cancel()` is valid only while `Errand.status = ASSIGNED` — matched to the original intent from early in this project: client can cancel before work starts, the applicant can cancel before starting, the system cancels on no-show. Once `IN_PROGRESS`, this path closes. **This surfaces a real gap**: there's currently no way to stop an abandoned mid-job errand — disputes only cover post-completion, cancel only covers pre-start. Flagged, not solved here.

## Actors

- **Client**, **applicant** (individual or org) — either can initiate
- **`NoShowDetectionJob`** — system-initiated, on behalf of nobody
- **application, errands, escrow, payment-gateway, chat modules**

## Step-by-step sequence

1. `CancelApplicationCommand { applicationId, cancelledByPartyId?, reason }` — three entry points:
   - Client calls it → `reason: CLIENT_CANCELLED`
   - Applicant calls it → `reason: WORKER_CANCELLED`
   - `NoShowDetectionJob` dispatches it internally → `reason: WORKER_NO_SHOW`, `cancelledByPartyId: null`
2. Guard: `Errand.status = ASSIGNED` (cross-module read into `errands`) — throws otherwise. `Application.status = ACCEPTED` required too.
3. Fresh `correlationId`. `Application.cancel(reason, cancelledByPartyId)` → `status: CANCELLED` → `ApplicationCancelled { applicationId, errandId, reason, cancelledByPartyId, correlationId }`
4. Same handler dispatches `CancelErrandCommand { errandId, reason, correlationId }` into `errands` — **not a separate client action**, a direct consequence
5. `Errand.cancel(reason)` → `status: CANCELLED`, cascades every non-terminal `ErrandAssignment` to `CANCELLED` in the same transaction → `ErrandCancelled { errandId, reason, correlationId }`
6. **`EscrowRefundSaga`** (now real, was deferred) → `RefundEscrowCommand { escrowId, correlationId }` → `Escrow.refund()` — valid here specifically because escrow is still `HELD` (nothing released yet, since release only happens on `ErrandCompleted`) → `EscrowRefunded { escrowId, errandId, correlationId }`
7. `payment-gateway`'s `OnEscrowRefundedHandler` → `RefundPaymentCommand` → refunds the client's original charge directly. **This is a genuinely different code path from the post-completion dispute refund** (which acts on `wallet`'s pending balance, since by then escrow is already empty) — worth not confusing the two.
8. **`ChatLifecycleSaga`** → `ChatThread.close()`
9. **`party`'s `OnApplicationCancelledHandler`** → increments `ProviderRole.cancelledErrandsCount` on the applicant, but only for `WORKER_CANCELLED`/`WORKER_NO_SHOW`, never `CLIENT_CANCELLED`
10. Notifications to all parties
11. Correlation chain stops

## No-show detection (now real)

`NoShowDetectionJob` (hourly) scans `Errand.findAssignedPastExpectedStart()` — every `Errand` still `ASSIGNED` past its `expectedStartAt` (set at assignment time, defaulting to `assignedAt + 24h` unless explicitly scheduled). For each, dispatches step 1 above with `reason: WORKER_NO_SHOW`.

## Org-internal reassignment — explicitly NOT this flow

If one member of a multi-worker org job needs to drop out, that's `RemoveAssignmentCommand` (org-internal, `ErrandAssignment.remove()`), not a full cancel — the engagement continues, just without that one member. The org is responsible for finding a replacement (reusing the same assignment mechanics as the original org acceptance), not the client or the platform.

## Relisting — a new Errand, not a reopened one

Once `Errand.status = CANCELLED` (terminal), the client can call `RelistErrandCommand { originalErrandId, updatedFields? }`, which creates a **fresh** `Errand` (`status: DRAFT`, `relistedFromErrandId: originalErrandId`), copying over the original's details unless the client overrides them. This finally uses the `relistedFromErrandId` field that's existed unused in the schema since the earliest version of this project — same reasoning as the trusted-circle-decline reassignment flow: don't force the client to re-enter everything from scratch, but don't pretend it's literally the same errand either (its history — old applications, the cancellation itself — stays with the original, cleanly separated).

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `ApplicationCancelled` | `application` | `{ applicationId, errandId, reason, cancelledByPartyId, correlationId }` | `party` (trust signal), Notification |
| `ErrandCancelled` | `errands` | `{ errandId, reason, correlationId }` | `EscrowRefundSaga`, `ChatLifecycleSaga`, Notification |
| `EscrowRefunded` | `escrow` | `{ escrowId, errandId, correlationId }` | `payment-gateway` |
| `PaymentRefunded` | `payment-gateway` | `{ paymentTransactionId, correlationId }` | Notification |
| `AssignmentRemoved` | `errands` | `{ errandAssignmentId, errandId, removedByOrganizationId, correlationId }` | Notification |
| `ErrandRelisted` | `errands` | `{ originalErrandId, newErrandId, correlationId }` | Notification |

## Algorithmic component

None.

## Open items

- **Mid-job abandonment gap** (see boundary note above) — the one thing this flow deliberately doesn't solve.
- Whether a replacement member (after `RemoveAssignmentCommand`) needs to meet the same tier eligibility re-check as the original assignment — almost certainly yes, by symmetry with everything else in this system, but not explicitly designed here.
- Whether repeated `WORKER_NO_SHOW` cancellations should eventually trigger something stronger than a trust-signal decrement (e.g. a temporary suspension) — a policy question, not a technical one.
