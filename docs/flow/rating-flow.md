# Flow: Rating (Client-Facing + Internal Org/Member)

## Actors

- **Client** — rates the org/individual they contracted with
- **Assigned member** — rates the org they worked for (internal)
- **Organization** — rates each member who worked the job (internal)

## Two kinds of rating, deliberately kept separate

- **Client-facing** (`context: CLIENT_FACING`) — score (1–5) **and** optional comment. Feeds the public `avgRatingCached` on the rated `Profile`.
- **Internal** (`context: INTERNAL`) — score only, **no comment**. Never shown publicly; visible only to the two direct parties. Doesn't feed the public average at all — this was a deliberate call to prevent an org from quietly tanking a member's *public* reputation as leverage.

## Step-by-step sequence

1. `ErrandCompleted` fires (from `errand-completion-flow.md`) → `RatingPromptSaga` sends notifications: client prompted to rate the applicant (`CLIENT_FACING`), each assigned member prompted to rate the org (`INTERNAL`), org prompted to rate each member (`INTERNAL`)
2. **Each submission is its own standalone, arbitrary-delay transaction** — a rater might act minutes or weeks later, so every `SubmitRatingCommand` gets its own fresh `correlationId`, never the `ErrandCompleted` chain's id (same rule as everywhere else this pattern shows up)
3. `SubmitRatingCommand { errandId, raterId, rateeId, context, score, comment? }`
   - Guard: `RatingNotAllowedError` unless `Errand.status = COMPLETED`
   - Guard: `RatingAlreadySubmittedError` — one rating per `(errandId, raterId, rateeId, context)` tuple. For `INTERNAL` with multiple assigned members, this means the org submits **one rating per member**, and each member submits **one rating of the org** — not a single blended rating for the whole job.
   - `comment` only accepted if `context = CLIENT_FACING`; silently ignored (or rejected — pick one, not yet decided) if submitted alongside `INTERNAL`
4. `Rating` saved. `RatingSubmitted { ratingId, errandId, rateeId, context, score, correlationId }`
5. **Only if `context = CLIENT_FACING`**: an immediate recompute of *that one profile's* recency-weighted average runs (cheap, keeps it fresh). `ProfileRatingRecalcJob` (nightly) sweeps everyone else, correcting for pure time-decay drift between new submissions.
6. Chain stops — Notification optionally acknowledges (low priority)

## Recency-weighted average (recap)

`weight = 0.5 ^ (ageInDays / halfLifeDays)`, half-life defaulting to ~180 days (tunable config, not fixed). Applies only to `CLIENT_FACING` ratings. `Rating` rows are never deleted or excluded from history — only their *weight in the average* fades.

## Worker-of-the-month/year badges — a separate, related concept

Not a `Rating` at all — a distinct `ProfileBadge { profileId, badgeType: WORKER_OF_THE_MONTH | WORKER_OF_THE_YEAR, awardedByOrganizationId, period, awardedAt }`, awarded by an org to its own current/former member via `AwardBadgeCommand`. Visible only on the **org-facing** profile view (a member considering joining a different org can see it), never the client-facing one — a query-level visibility distinction, not a domain-level one.

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `RatingSubmitted` | `rating` | `{ ratingId, errandId, rateeId, context, score, correlationId }` | Immediate recalc (if `CLIENT_FACING`), Notification |
| `ProfileBadgeAwarded` | `profile` (or a small `badges` sub-concern within it) | `{ profileId, badgeType, awardedByOrganizationId, period, correlationId }` | Notification |

## Algorithmic component

Exponential decay weighting for the recency-weighted average — not really a discrete-algorithms topic (CLRS doesn't cover this), closer to a standard exponential-smoothing/statistics formula. No dedicated chapter reference needed beyond that.

## Open items

- Whether a rejected/silently-ignored `comment` on an `INTERNAL` rating should be a hard validation error or just dropped — not decided.
- Whether `AwardBadgeCommand` requires the member to still be currently active in the org, or can be awarded retroactively after they've left — not decided.
