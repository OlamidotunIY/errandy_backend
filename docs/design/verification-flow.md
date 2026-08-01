# Flow: Verification (Tiered, One Profile-Wide VerificationProfile)

## Actors

- **Profile** (adding `PROVIDER` capability, or requesting a tier upgrade)
- **verification module** — owns `VerificationProfile`/`VerificationStep`
- **Admin** (via better-auth, permission-gated — see `admin-permissions` note in the main doc)
- **NINVerificationApiAdapter** — external KYC API

## Recap of the model this flow operates on

One `VerificationProfile` per `Profile` (not per capability, not per subject-type — that distinction was retired). `requiredSteps` is recalculated, not fixed at creation. Email/phone are **not** steps here at all — they're better-auth's `emailVerified`/`phoneNumberVerified` fields, checked separately by `VerificationGatePolicy`.

## Step-by-step sequence

1. `AddCapabilityCommand { profileId, capability: PROVIDER }` and/or `RequestTierUpgradeCommand { profileId, targetTier }`
2. Handler calls `VerificationProfile.recalculateRequiredSteps(capabilities, targetTier)` — adds any newly-required step as `PENDING`. **Never deletes historical steps** — a step that's no longer required (e.g. downgrading target tier) stays on record for audit, just excluded from the `overallStatus` check going forward.
3. Worker submits documents, one step at a time: `SubmitVerificationStepCommand { profileId, stepType, documentUrls }`
   - `DocumentStorageAdapter` stores the files, returns URLs only — *(Claim Check pattern: the event/command never carries the document bytes themselves, just a reference)*
   - `VerificationStep.status: SUBMITTED`
   - Fresh `correlationId`. `VerificationStepSubmitted { verificationProfileId, stepType, correlationId }`
4. **`AutoKYCReviewSaga`** (thin, single-hop — reclassified from "process manager" earlier in this project, since it's genuinely just one conditional event→command dispatch, no compensation) — listens for `VerificationStepSubmitted` where `stepType = NIN_VERIFIED`:
   - Calls `NINVerificationApiAdapter`
   - On a conclusive match → dispatches `ApproveVerificationStepCommand { verificationProfileId, stepType, reviewerId: null }` (system-approved, no human reviewer), same `correlationId`
   - On inconclusive/no-match → leaves it `PENDING`/`SUBMITTED`, falls through to manual admin review
5. **Manual admin review** (for `LICENSE_VERIFIED`, `BUSINESS_REG_VERIFIED`, or any NIN check the auto-saga couldn't resolve):
   - `ApproveVerificationStepCommand { verificationProfileId, stepType, reviewerId }` / `RejectVerificationStepCommand { ..., reason }`
   - Handler checks `auth.api.userHasPermission(reviewerId, { verification: ['approve'] })` before executing — permission model lives entirely in better-auth's admin plugin, not a custom RBAC engine
   - **Fresh `correlationId`** here — arbitrary time has passed since submission (hours, days), so this does *not* inherit the submission's id, same arbitrary-delay rule as everywhere else in this system
6. `VerificationStep.status: APPROVED`/`REJECTED` → `VerificationStepApproved`/`VerificationStepRejected { ..., correlationId }`
7. `VerificationProfile` checks: are **all currently-required** steps `APPROVED`? If yes → `overallStatus: COMPLETE` → `VerificationCompleted { profileId, correlationId }` (same id as the approval that completed it)
8. `@EventsHandler(VerificationCompleted)` in `profile` module → updates `Profile.tier` to match the newly-achieved level (e.g. all `ARTISAN`-tier steps done → `tier: VERIFIED`) → stops, terminal

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `VerificationStepSubmitted` | `verification` | `{ verificationProfileId, stepType, correlationId }` | `AutoKYCReviewSaga` |
| `VerificationStepApproved` | `verification` | `{ verificationProfileId, stepType, reviewerId, correlationId }` | Notification |
| `VerificationStepRejected` | `verification` | `{ verificationProfileId, stepType, reviewerId, reason, correlationId }` | Notification |
| `VerificationCompleted` | `verification` | `{ profileId, correlationId }` | `profile` module (tier update), Notification |

## Algorithmic component

None — this is stepwise state management, no computational problem to solve.

## Open items

- Should a **rejected** step let the worker resubmit immediately, or is there a cooldown/limit on resubmission attempts (fraud-prevention consideration)? Not yet decided.
- Does downgrading `targetTier` (e.g. a Professional-tier worker stepping back to Artisan-only work) ever need to happen, and if so does it change `overallStatus` retroactively? Edge case, not yet designed.
