# Flow: Errand Completion (Multi-Worker Confirm → Escrow Release → Payout Split)

## Actors

- **Assigned members** (one or more `ErrandAssignment` rows per errand — always at least one, even for a solo individual job, per the earlier consistency decision)
- **Client** — final confirmer
- **errands, escrow, wallet modules**

## Step-by-step sequence

1. Each assigned member taps "I'm done," independently, whenever they finish their part: `ConfirmAssignmentCompletionCommand { errandAssignmentId, profileId, proofUrl? }`
   - Guard: only the assignment's own `profileId` can confirm it; only from `status: ASSIGNED`
   - `ErrandAssignment.confirmDone()` → `status: CONFIRMED_DONE`, `confirmedAt: now`, `proofUrl` stored if provided
   - **Fresh `correlationId` per confirmation** — each member acts independently, at their own arbitrary time, so these are separate transactions, not a shared chain
   - `AssignmentConfirmedDone { errandAssignmentId, errandId, profileId, correlationId }` → Notification tells the client "Worker X marked their part done"
2. **Same-transaction check**: after any confirmation, the handler checks whether *all* assignments for this errand are now `CONFIRMED_DONE`. If so — this is a direct synchronous consequence of that specific confirm, so it keeps that same `correlationId`, not a new one — an `ErrandReadyForCompletion { errandId, correlationId }` signal fires, prompting the client: "all workers report done, you can now mark this complete." **This also schedules a delayed job** (`AutoAcceptErrandJob`, BullMQ delayed 24h from this moment) — if the client hasn't acted within 24 hours, the system completes it on their behalf.
2a. **A confirmed member cannot un-confirm** (no path back to `ASSIGNED`), but **can edit** their confirmation while it's still editable — `UpdateAssignmentConfirmationCommand { errandAssignmentId, profileId, proofUrl }`, valid only while `status: CONFIRMED_DONE` **and** the errand isn't yet `COMPLETED` (client-completion or auto-accept both lock it). Raises `AssignmentConfirmationUpdated { errandAssignmentId, proofUrl, correlationId }` — fresh id each edit, Notification only, no cascade.
3. Client reviews, calls `CompleteErrandCommand { errandId }` **within the 24-hour window**
   - Guard: throws `NotAllAssignmentsConfirmedError` unless every `ErrandAssignment` is `CONFIRMED_DONE`
   - `Errand.complete()` → `status: COMPLETED`, `completedAt: now`, `completedBy: CLIENT`
   - **Fresh `correlationId`** — arbitrary delay between the "ready" signal and the client actually acting on it
   - `ErrandCompleted { errandId, completedBy: CLIENT, correlationId }`
   - **Also cancels the pending `AutoAcceptErrandJob`** — no point letting it fire against an already-completed errand
3a. **If the 24 hours elapse first**: `AutoAcceptErrandJob` fires — re-checks `Errand.status` is still eligible (idempotent no-op if the client already completed it in the meantime, since BullMQ delayed jobs and manual completion can race) — then completes it as the system: `Errand.complete()` → `completedBy: SYSTEM` → `ErrandCompleted { errandId, completedBy: SYSTEM, correlationId }` *(fresh id, since this is the system acting well after the original confirmation chain ended)*
4. **`EscrowReleaseSaga`** (thin, single-hop) → `ReleaseEscrowCommand { escrowId, correlationId }` → `Escrow.release()` → `status: RELEASED` → `EscrowReleased { escrowId, errandId, amountMinorUnits, correlationId }`
5. **Payout split** (see algorithm below) — one or more `Wallet.credit()` calls, each writing a `Ledger` row (`referenceType: ESCROW_RELEASE`, `referenceId: escrowId`), each raising its own `WalletCredited { walletId, amountMinorUnits, referenceId, correlationId }`, all sharing the same `correlationId`
6. **`RatingPromptSaga`** → notifications prompting: client → rate the org/individual (client-facing), each assigned member → rate the org (internal), org → rate each member (internal). Actual `Rating` submission is its own later, standalone transaction — see `rating-flow.md` (pending)
7. **`ChatLifecycleSaga`** → `ChatThread.close()`
8. Correlation chain stops — nothing left to cascade

## Payout split calculation

```
total = escrow.amountMinorUnits
if applicant is an organization (has members):
  workerPoolPct = errand.workerPoolPercentageOverride ?? applicantOrg.workerPoolPercentage
  orgShare = total × (100 − workerPoolPct) / 100        → credited to the org's own wallet
  workerPool = total × workerPoolPct / 100
  assignments = ErrandAssignment.findByErrandId(errandId)
  if every assignment has an explicit splitPercentage (summing to 100):
    each member's share = workerPool × their splitPercentage / 100
  else:
    each member's share = workerPool / count(assignments)   — equal split
else:
  the single assignment's profile gets 100% of total
```

**Algorithmic component — this is the one real subtlety here.** Splitting an integer amount (minor units — minor units, cents) proportionally across N recipients using floor/truncated division will not necessarily sum back to the original total — you can silently lose a few minor units to nowhere, or in some formulations over-allocate. This is the classic **apportionment / fair-division rounding problem**, not something CLRS covers (it's closer to social-choice/election-science literature than algorithms texts) — but it's a real, easy-to-get-wrong correctness issue in any financial split logic:

1. Compute each recipient's **exact floor** share: `floor(total × percentage / 100)`
2. Sum the floors — this will be `≤ total`, the difference is the leftover minor units from truncation
3. Distribute the leftover, one minor unit at a time, to the recipients with the **largest fractional remainder** first (the **Largest Remainder Method**, a.k.a. Hamilton's method), until the leftover is exhausted

This guarantees the sum of all recipient shares exactly equals `total`, with no silent drift. Worth writing this as a small shared utility (`splitProportionally(total, weights[])`) used anywhere a `Money` amount needs dividing — this same problem will recur for anything else proportionally split later.

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `AssignmentConfirmedDone` | `errands` | `{ errandAssignmentId, errandId, profileId, correlationId }` | Notification |
| `AssignmentConfirmationUpdated` | `errands` | `{ errandAssignmentId, proofUrl, correlationId }` | Notification |
| `ErrandReadyForCompletion` | `errands` | `{ errandId, correlationId }` | Notification, schedules `AutoAcceptErrandJob` |
| `ErrandCompleted` | `errands` | `{ errandId, completedBy: CLIENT \| SYSTEM, correlationId }` | `EscrowReleaseSaga`, `RatingPromptSaga`, `ChatLifecycleSaga` |
| `EscrowReleased` | `escrow` | `{ escrowId, errandId, amountMinorUnits, correlationId }` | Payout split handler (`wallet`) |
| `WalletCredited` | `wallet` | `{ walletId, amountMinorUnits, referenceId, correlationId }` (one per recipient) | Notification |

## Open items

- Whether `dispute` eligibility differs based on `completedBy` (e.g. does an auto-accepted errand get a longer dispute window, since the client never actively reviewed it)? Worth considering given disputes can now only be raised after completion (see `dispute-flow.md`).
