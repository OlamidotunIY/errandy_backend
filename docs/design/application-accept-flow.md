# Flow: Application Acceptance (Charge → Escrow → Assignment)

Covers both sourcing paths that end in a paid, assigned errand via the `Application` aggregate:
- **BID** — a worker/org applied to an open errand; the client accepts one bid.
- **DIRECT_OFFER** — a client assigned the errand straight to a trusted circle member; the member accepts the offer.

Both share the exact same downstream mechanics from the moment acceptance is triggered — only *who* is authorized to trigger it, and how the `Application` row was created, differ.

## Actors

- **Client** — posts the errand, either receives bids (BID) or picks a trusted member up front (DIRECT_OFFER)
- **Provider / Organization** (via `Profile`) — the applicant or offered member
- **payment-gateway module** — external charge + webhook confirmation
- **errands, escrow modules** — downstream consequences of a successful charge

## Preconditions

- Errand exists, `status = PUBLISHED` (BID) or `status = DRAFT` (DIRECT_OFFER, not yet visible publicly)
- `ProfileEligibilityPolicy` already passed at application/offer-creation time (tier check, verification gate)

## Step-by-step sequence

1. **Entry point** — one of two commands creates the `PENDING` `Application`:
   - `SubmitApplicationCommand` (worker-initiated, `originType: BID`)
   - `AssignErrandToTrustedMemberCommand` (client-initiated, `originType: DIRECT_OFFER`) — also creates the `Errand` itself in the same step, `status: DRAFT`
2. **Acceptance trigger** — `RequestApplicationAcceptanceCommand { applicationId, requesterProfileId }`
   - Authorization check: for `BID`, `requesterProfileId` must be the errand's client; for `DIRECT_OFFER`, it must be the offered member. *(Content-Based Router: same command, branching authorization based on `Application.originType`.)*
   - Handler generates a fresh `correlationId` **(Correlation Identifier pattern — this is the root of the widest chain in the system)**
   - Creates `AcceptApplicationProgress { applicationId, status: CHARGE_INITIATED, correlationId }`
   - Dispatches `InitiateChargeCommand { clientId, purposeId: applicationId, amountMinorUnits, currency, paymentMethodId, correlationId }` into `payment-gateway`
   - Returns immediately — does **not** wait for the charge to resolve
3. **Async gateway confirmation** — payment-gateway's own webhook controller (unrelated code, not part of this flow) receives the callback, calls `PaymentTransaction.markSucceeded()` / `markFailed()`, raises `PaymentSucceededEvent` / `PaymentFailedEvent` on the in-memory `EventBus`
4. **Bridge handlers** (`application/event-handlers/`) — `OnPaymentSucceededHandler` / `OnPaymentFailedHandler` look up `AcceptApplicationProgress.findByApplicationId(event.purposeId)`; if no matching progress row exists, no-op (this is how a service-booking payment, which never created a progress row, is safely ignored without needing a `purposeType` field). If found, enqueue a job onto the `accept-application-continue` BullMQ queue. **(Competing Consumers — multiple workers can drain this queue in parallel across different applications.)**
5. **`AcceptApplicationContinueProcessor`** picks up the job, dispatches the matching command based on `job.name`:
   - `payment-succeeded` → `AcceptApplicationCommand { applicationId, paymentTransactionId, correlationId }`
   - `payment-failed` → `MarkApplicationAcceptanceFailedCommand { applicationId, correlationId }`
   - Permanent failures are recorded via `IDeadLetterRepository` **(Dead Letter Channel)**; transient ones are logged and left to BullMQ's own retry/backoff.
6. **`AcceptApplicationCommand` handler** — resumes from wherever `progress.status` left off, each block idempotent **(Idempotent Receiver — safe to redeliver/replay)**:
   - `CHARGE_INITIATED` → `Application.accept(correlationId)` (own aggregate, no command needed) → `progress.markAccepted()`
   - `ACCEPTED` → dispatch `AssignErrandCommand` into `errands` → `progress.markErrandAssigned()`
   - `ERRAND_ASSIGNED` → dispatch `CreateEscrowCommand` into `escrow` → `progress.markCompleted()`
7. **`RejectOtherApplicationsSaga`** (only relevant for `BID`) — listening for `ApplicationAccepted`, dispatches `RejectOtherApplicationsCommand` for every sibling `PENDING` application on the same errand, reusing the same `correlationId`
8. **`ChatLifecycleSaga`** (in `errands`) — `ErrandAssigned` → opens the `ChatThread`, same `correlationId`
9. **Correlation ID stops here** — no further direct consequence; `Notification` picks up various events along the way independently, but that's outside the cascade

## Failure branch

- `MarkApplicationAcceptanceFailedCommand` → `progress.markFailed()`. Nothing else touched. `Application` stays `PENDING`.
- Client (or offered member, for `DIRECT_OFFER`) can immediately retry — a fresh `RequestApplicationAcceptanceCommand` call, brand-new `correlationId`, brand-new `AcceptApplicationProgress` row.

## Resolved branch: DIRECT_OFFER declined

If the offered member **declines**, the client must manually re-offer or publish — no auto-fallback to `OPEN_BID`. To help them, `SuggestReassignmentCandidatesQuery` returns a ranked list blending the client's own trusted-circle members (matching category/tier) with externally-suggested high-trust candidates (matching category/tier/market, ranked by composite score, not necessarily in the client's circle). See `errand-reassignment-flow.md` for the full walkthrough — added to the index below.

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `ApplicationSubmitted` | `application` | `{ applicationId, errandId, applicantId, correlationId }` | Notification |
| `PaymentSucceeded` | `payment-gateway` | `{ paymentTransactionId, purposeId, amountMinorUnits, correlationId }` | `application` (bridge handler), `escrow` (if service-booking path) |
| `PaymentFailed` | `payment-gateway` | `{ paymentTransactionId, purposeId, reason, correlationId }` | `application` (bridge handler), Notification |
| `ApplicationAccepted` | `application` | `{ applicationId, errandId, applicantId, correlationId }` | `RejectOtherApplicationsSaga`, Notification |
| `ApplicationRejected` | `application` | `{ applicationId, errandId, correlationId }` | Notification |
| `ErrandAssigned` | `errands` | `{ errandId, acceptedApplicationId, correlationId }` | `ChatLifecycleSaga`, Notification |
| `EscrowCreated` | `escrow` | `{ escrowId, errandId, amountMinorUnits, correlationId }` | — |

## Algorithmic component

None of significance — this is state-machine orchestration plus queue-based retry, not a computational problem. No CLRS chapter applies here.
