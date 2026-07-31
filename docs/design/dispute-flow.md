# Flow: Dispute Resolution

## Actors

- **Raiser** — client or an assigned member, on a specific errand
- **Admin** — reviewer/resolver, permission-gated via better-auth (`dispute: ['assign-reviewer', 'resolve', 'reject']`)
- **dispute, escrow modules**

## Interaction with escrow's auto-release job

This is the reason `Dispute` exists as a gate, not just a complaints log: `EscrowAutoReleaseJob` checks for an open dispute before firing — a dispute is what stops money from automatically flowing out while something's contested.

## Step-by-step sequence

1. `OpenDisputeCommand { errandId, raisedById, raisedByType, reason, description }` — guard: `ErrandNotEligibleForDisputeError` unless `Errand.status = COMPLETED` (this includes both `completedBy: CLIENT` and `completedBy: SYSTEM` per `errand-completion-flow.md`'s 24-hour auto-accept — a dispute is exactly the mechanism for contesting a job after the fact, whether the client actively signed off or the system did it for them). Disputes cannot be raised mid-job (`IN_PROGRESS`) — this also means the dispute flow never overlaps with the multi-worker confirmation flow at all; they're fully sequential, not concurrent.
2. Fresh `correlationId`. `Dispute { status: OPEN }` saved. `DisputeOpened { disputeId, errandId, correlationId }`
3. **`EscrowAutoReleaseJob`** (nightly/periodic) — on its next run, checks `Dispute.findOpen(errandId)` before releasing; if one exists, skips this errand entirely, no event raised for the skip (it's a no-op, not a state change)
4. `AssignReviewerCommand { disputeId, reviewerId }` — admin-side, permission-checked (`dispute: ['assign-reviewer']`) → `Dispute.status: UNDER_REVIEW` → `DisputeUnderReview { disputeId, reviewerId, correlationId }` *(fresh id — arbitrary delay since the dispute was opened, an admin picks it up whenever)*
5. Reviewer investigates (off-system — evidence attached via `DocumentStorageAdapter`, Claim Check pattern, same as verification documents)
6. `ResolveDisputeCommand { disputeId, resolution, resolvedById }` — permission-checked (`dispute: ['resolve']`) → fresh `correlationId` → `Dispute.status: RESOLVED` → `DisputeResolved { disputeId, errandId, resolution, correlationId }`
7. **`DisputeResolutionSaga`** (thin, single conditional hop — reclassified from "process manager" earlier, since it's genuinely just a branch on `resolution`, no compensation): dispatches either `ReleaseEscrowCommand` or `RefundEscrowCommand`, same `correlationId`, cascading into the same wallet-credit / payment-refund mechanics as the normal completion/cancellation paths
8. Alternatively, `RejectDisputeCommand { disputeId, resolvedById, reason }` → `Dispute.status: REJECTED` → `DisputeRejected { disputeId, correlationId }` — no escrow action; whatever the escrow's default outcome would have been proceeds normally on the next `EscrowAutoReleaseJob` run (dispute no longer blocks it)
9. Chain stops — Notification picks up each of these events independently

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `DisputeOpened` | `dispute` | `{ disputeId, errandId, correlationId }` | `EscrowAutoReleaseJob` (checked, not subscribed — a query, not an event reaction), Notification |
| `DisputeUnderReview` | `dispute` | `{ disputeId, reviewerId, correlationId }` | Notification |
| `DisputeResolved` | `dispute` | `{ disputeId, errandId, resolution, correlationId }` | `DisputeResolutionSaga` |
| `DisputeRejected` | `dispute` | `{ disputeId, correlationId }` | Notification |

## Algorithmic component

None.

## Open items

None remaining for this flow — both prior open questions (dispute timing, and whether it overlaps with the completion-confirmation flow) are resolved by the completed-only guard above.
