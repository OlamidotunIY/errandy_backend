# Errand Platform — Module Architecture Reference

Consolidates every module as currently designed: domain layer (entities, value objects, repositories, events, errors), application layer (commands, jobs, event handlers, queries, sagas), and infrastructure layer (adapters, mappers, repository implementations).

## Decision Log (major changes since the previous version of this doc)

1. **`Client`/`Provider`/`Organization` merged into one `Profile` aggregate**, distinguished by `kind` (INDIVIDUAL/ORGANIZATION) and `capabilities` (CLIENT/PROVIDER/BOTH, mutable — a profile can add capabilities over time). This retired `XType` discriminator fields across the whole system (`Application.applicantType`, `Service.listedByType`, `TrustedCircleMember.memberType`, etc.) — everything just references a `profileId` now.
2. **`users` is no longer our module at all.** Identity, credentials, sessions, and email/phone verification are entirely owned by **better-auth**. We integrate via an Anti-Corruption Layer (`databaseHooks`) that translates better-auth's user-creation lifecycle into our own `AuthUserRegistered` event, which `profile` reacts to by creating a `Profile`. See `docs/flows/user-registration-flow.md`.
3. **`admin` is not a module either.** Admins are better-auth users who simply never get a `Profile`. Permissions are modeled via better-auth's admin plugin (`createAccessControl`, resource/action statements), not a custom RBAC engine.
4. **Multi-currency, market-isolated.** Every `XKobo` field became `Money { amountMinorUnits, currency }`. A new `Market` entity (seed data, not admin-managed yet) ties one country to one currency. Every `Profile` and `Errand` has a `marketId`; a provider in one market structurally cannot see or apply to errands in another (same principle as Uber's city isolation) — no cross-market/cross-currency logic exists anywhere.
5. **`Ledger`, never `Transaction`.** `Wallet.balanceMinorUnits` is a cached projection; the append-only `Ledger` is the sole source of truth for money movement, reconciled by a nightly job.
6. **`Category`** — new small shared module, hierarchical (parent/child), replacing both the old category-taxonomy idea and `Service`'s freeform category string. Only leaf categories carry `requiredTier` and are assignable.
7. **`ErrandAssignment`** — new entity, since an errand can now have multiple assigned workers (not just one). Each assignment is individually confirmed by its member (cannot un-confirm, can edit/add proof), and `Errand.complete()` is gated on all assignments being confirmed — with a 24-hour auto-accept timeout if the client doesn't act.
8. **Payment/accept flow no longer has a "Process Manager" class.** That abstraction was tried and removed — the pattern that replaced it is: a persisted progress entity (`AcceptApplicationProgress`) + ordinary command handlers (`RequestApplicationAcceptanceCommand` to start, `AcceptApplicationCommand` to resume) + a BullMQ processor bridging the async payment-gateway webhook back into a command. See `docs/flows/application-accept-flow.md`.
9. **Sagas vs. process managers, precisely defined**: a saga is a thin `@Saga()` — one event in, one command out, no persisted state, safe to replay. Several things previously mislabeled "process manager" were reclassified as sagas (`EscrowReleaseSaga`, `EscrowRefundSaga`, `DisputeResolutionSaga`, `AutoKYCReviewSaga`) once it was clear they had no real compensation logic. Genuine multi-step, money-critical flows needing persisted progress are `AcceptApplicationProgress`-style — currently only the application-accept and withdrawal flows.
10. **Withdrawal debits immediately on request** (not on completion), specifically to prevent a double-withdrawal race; a failed transfer issues a compensating credit and **does not auto-retry** — the user is notified and must manually re-initiate.
11. **Dispute can only be raised after `Errand.status = COMPLETED`** — never mid-job. This also means dispute-raising and the multi-worker completion-confirmation flow never overlap in time.
12. **Rating has two contexts**: `CLIENT_FACING` (score + comment, feeds the public recency-weighted average) and `INTERNAL` (org↔member, score only, never public — deliberately kept separate so an org can't quietly damage a member's public reputation).
13. **Cancel** (`Application.cancel()`, `Errand.cancel()`) remains deferred, per the original decision — untouched by anything above.

## Correlation ID convention

- A **fresh `correlationId`** is generated once, at the top-level command that starts a business transaction.
- It's threaded through every event/command that fires as a **direct, synchronous consequence** of that command, across however many modules the cascade touches.
- It **stops** once the cascade has no further direct consequence (typically at `notification`, or a terminal state).
- **Arbitrary-delay workflows never share a `correlationId` across the gap** — if real time passes because a *different actor* has to act (share→confirm, offer→accept/decline, submission→admin review, job-completion→rating), the next step is its own new transaction with its own fresh id, linked only by a persisted reference (`sharedFromProfileId`, `memberEntryId`, etc.), never by `correlationId`. This rule recurs constantly — see every flow doc in `docs/flows/`.

## Conventions — folder structure and async patterns

```
src/modules/<module-name>/
├── domain/
│   ├── entities/            <- includes progress-tracking entities like AcceptApplicationProgress
│   ├── value-objects/
│   ├── repositories/         <- interfaces only
│   ├── events/
│   └── errors/
├── application/
│   ├── commands/              <- ICommandHandler, @CommandHandler
│   ├── event-handlers/        <- IEventHandler, @EventsHandler (flat — includes bridge handlers that enqueue jobs)
│   ├── sagas/                 <- @Saga() — thin, single event-to-command hop, no persisted state
│   ├── processors/            <- BullMQ @Processor/WorkerHost — money-critical async continuations, paired with a DLQ
│   ├── queries/                <- IQueryHandler, @QueryHandler
│   └── jobs/                    <- scheduled/cron
├── infrastructure/
│   ├── mappers/
│   └── repositories/
└── <module-name>.module.ts
```

**Money-critical async continuation pattern** (used by `application`'s accept flow and `wallet`'s withdrawal flow): an in-memory domain event fires → a thin bridge `@EventsHandler` enqueues a BullMQ job (never does business logic itself) → a `@Processor`/`WorkerHost` dispatches the actual resuming command, using an `ErrorClassifier` to distinguish transient vs. permanent failures, recording permanent ones via `IDeadLetterRepository`. Every step in the resumed command handler checks a persisted `status` field before acting, so replay/redelivery is always a safe no-op (Idempotent Receiver).

---

## Integration concerns (not modules — external systems we sit on top of)

### better-auth
Owns all identity: signup/login, sessions, email/phone verification, password reset. We plug in exactly two things: delivery callbacks (`sendVerificationEmail`, `sendOTP`, implemented via our own `EmailAdapter`/`SmsAdapter`) and a `databaseHooks.user.create` Anti-Corruption Layer that resolves `Market` from phone number (aborting signup for unsupported markets) and publishes `AuthUserRegistered` on our own event bus once the user is created. See `docs/flows/user-registration-flow.md`.

### Admin permissions (better-auth admin plugin)
Admins are better-auth users with no `Profile`. Permissions defined via `createAccessControl` — resources `verification: ["approve", "reject"]`, `dispute: ["assign-reviewer", "resolve", "reject"]` — composed into roles (`verificationReviewer`, `disputeResolver`, `superAdmin`). Every privileged command handler checks `auth.api.userHasPermission(...)` before executing. `Dispute.resolvedById`/`VerificationStep.reviewerId` store the raw better-auth user id.

---

## 1. profile

*(merges the old `client`, `provider`, `organizations` modules)*

### Domain
- **`Profile`** (aggregate root) — `id`, `userId` (better-auth user id, unique for INDIVIDUAL), `ownerId` (better-auth user id, set for ORGANIZATION), `kind: INDIVIDUAL|ORGANIZATION`, `capabilities: CLIENT|PROVIDER|BOTH` (mutable), `marketId`, `name` (organizations), `businessRegistrationNumber` (organizations), `tier: COMMUNITY|VERIFIED|CERTIFIED` (null until PROVIDER capability added), `bio`, `skills: string[]`, `verificationStatus: boolean`, `trustedByCount`, `completedErrandsCount`, `disputedErrandsCount`, `avgResponseTimeSeconds`, `avgRatingCached`, `workerPoolPercentage` (organizations, default split when paying assigned members), `isActive`, `createdAt`, `updatedAt`
- **`ProfileMember`** (entity, within `Profile` when `kind = ORGANIZATION`) — `id`, `profileId` (the org), `userId` (the individual), `role: OWNER|ADMIN|MEMBER`, `active`
- **Repository**: `IProfileRepository` — `save`, `findById`, `findByUserId`, `findMembers(profileId)`
- **Errors**: `ProfileNotFoundError`, `MemberAlreadyInOrganizationError`, `MemberNotInOrganizationError`

### Application
- **Commands**: `AddCapabilityCommand { profileId, capability }`, `UpdateProfileCommand { profileId, bio?, skills? }`, `DeactivateProfileCommand { profileId }`, `AddOrganizationMemberCommand`, `RemoveOrganizationMemberCommand`, `RequestTierUpgradeCommand { profileId, targetTier }`, `AwardBadgeCommand { profileId, badgeType, awardedByOrganizationId, period }`
- **Event Handlers**: `VerificationCompleted` → set `verificationStatus`/`tier`; `TrustedCircleMemberConfirmed`/`Removed` → adjust `trustedByCount`; `ErrandCompleted` → increment `completedErrandsCount` for the assigned member(s), and for the org if it was the applicant; `DisputeOpened` → increment `disputedErrandsCount`; `RatingSubmitted` (CLIENT_FACING only) → immediate recompute of `avgRatingCached`; `AuthUserRegistered` → create the initial `Profile`
- **Jobs**: `ProviderResponseTimeRecalcJob` (nightly, from `chat`'s `firstResponseAt`), `ProfileRatingRecalcJob` (nightly, recency-decay sweep), `MonthlyTrustStatsJob` (dashboard stats)
- **Queries**: `GetProfileByIdQuery`, `GetProfilePublicProfileQuery` (client-facing — no badges), `GetProfileOrgFacingViewQuery` (includes badges, internal ratings), `SearchProvidersByServiceQuery`
- **Sagas**: `TrustedByCountSyncSaga` (owned here as consumer; trigger lives in `trusted-circle`)

### Infrastructure
- **Mappers**: `ProfileMapper`
- **Repository impl**: `ProfileRepository`

**`ProfileBadge`** (entity, org-facing only) — `id`, `profileId`, `badgeType: WORKER_OF_THE_MONTH|WORKER_OF_THE_YEAR`, `awardedByOrganizationId`, `period`, `awardedAt`

---

## 2. address

### Domain
- **`Address`** — `id`, `ownerUserId`, `label`, `street`, `city`, `state`, `country`, `latitude`, `longitude`, `isDefault`, `createdAt`, `updatedAt`
- **Value Objects**: `Coordinates { latitude, longitude }`
- **Repository**: `IAddressRepository` — `save`, `findById`, `findByUserId`
- **Errors**: `AddressNotFoundError`

### Application
- **Commands**: `CreateAddressCommand`, `UpdateAddressCommand`, `SetDefaultAddressCommand`, `DeleteAddressCommand`
- **Events**: `AddressCreated`, `AddressUpdated`, `DefaultAddressChanged`
- **Queries**: `GetAddressByIdQuery`, `ListAddressesByUserQuery`

### Infrastructure
- **Adapters**: `GeocodingAdapter`
- **Mappers**: `AddressMapper`
- **Repository impl**: `AddressRepository`

---

## 3. verification

### Domain
- **`VerificationProfile`** (aggregate root, **one per `Profile`**, not per subject-type) — `id`, `profileId` (unique), `requiredSteps: StepType[]` (recalculated, not fixed at creation), `overallStatus: INCOMPLETE|COMPLETE`, `createdAt`, `updatedAt`
- **`VerificationStep`** (entity) — `id`, `stepType: NIN_VERIFIED|LICENSE_VERIFIED|BUSINESS_REG_VERIFIED`, `status: PENDING|SUBMITTED|APPROVED|REJECTED`, `documentUrls: string[]`, `submittedAt`, `reviewedAt`, `reviewerId` (better-auth admin id, nullable if system-approved), `rejectionReason`
- **Repository**: `IVerificationProfileRepository` — `save`, `findById`, `findByProfileId`, `findPendingSteps()`
- **Errors**: `VerificationProfileNotFoundError`, `StepAlreadyApprovedError`, `MissingRequiredDocumentsError`

Email/phone confirmation are **not** steps here — they're better-auth's `emailVerified`/`phoneNumberVerified`, checked directly by `VerificationGatePolicy`.

### Application
- **Commands**: `SubmitVerificationStepCommand`, `ApproveVerificationStepCommand`, `RejectVerificationStepCommand`
- **Events**: `VerificationStepSubmitted`, `VerificationStepApproved`, `VerificationStepRejected`, `VerificationCompleted`
- **Jobs**: none (the KYC check is event-driven, see saga below)
- **Queries**: `GetVerificationProfileByProfileIdQuery`, `ListPendingVerificationStepsQuery`
- **Sagas**: `AutoKYCReviewSaga` (reclassified from "process manager" — thin, single conditional hop) — `VerificationStepSubmitted` (NIN only) → external API call → `approveStep()`/leaves for manual review

### Infrastructure
- **Adapters**: `NINVerificationApiAdapter`, `LicenseVerificationApiAdapter`, `DocumentStorageAdapter`
- **Mappers**: `VerificationProfileMapper`
- **Repository impl**: `VerificationProfileRepository`

---

## 4. category

### Domain
- **`Category`** — `id`, `name`, `parentCategoryId: string|null`, `requiredTier: ProfileTier|null` (only set on leaf categories)
- **Repository**: `ICategoryRepository` — `save`, `findById`, `findChildren(parentId)`, `findRoots()`, `findLeaves()`
- **Errors**: `CategoryNotFoundError`, `CategoryNotLeafError`

### Application
- **Commands**: none yet (seed-managed for now, same as `Market`)
- **Queries**: `ListCategoryTreeQuery`

### Infrastructure
- **Mappers**: `CategoryMapper`
- **Repository impl**: `CategoryRepository`

---

## 5. service

### Domain
- **`Service`** — `id`, `listedById` (Profile), `title`, `description`, `categoryId` (leaf `Category`), `price: Money`, `isActive`, `createdAt`, `updatedAt`
- **Repository**: `IServiceRepository` — `save`, `findById`, `findByListerId`, `findActiveByCategory`
- **Errors**: `ServiceNotFoundError`, `ServiceNotOwnedByListerError`

### Application
- **Commands**: `ListServiceCommand`, `UpdateServicePriceCommand`, `DeactivateServiceCommand`
- **Events**: `ServiceListed`, `ServiceDeactivated`
- **Queries**: `SearchServicesQuery`, `GetServiceByIdQuery`
- **Sagas**: none — the tier/verification gate is a synchronous check inside the command handler

### Infrastructure
- **Mappers**: `ServiceMapper`
- **Repository impl**: `ServiceRepository`

---

## 6. errands

### Domain
- **`Errand`** — `id`, `clientId` (Profile), `serviceId: ServiceId|null`, `categoryId`, `title`, `description`, `addressId`, `budget: Money`, `status: DRAFT|PUBLISHED|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED|ARCHIVED`, `sourceType: OPEN_BID|TRUSTED_DIRECT_ASSIGN|SERVICE_BOOKING`, `requiredTier: ProfileTier`, `marketId`, `acceptedApplicationId: ApplicationId|null`, `workerPoolPercentageOverride: number|null`, `startedAt`, `completedAt`, `completedBy: CLIENT|SYSTEM|null`, `cancelledAt`, `relistedFromErrandId`, `createdAt`, `updatedAt`
- **`ErrandAssignment`** (entity) — `id`, `errandId`, `profileId`, `assignedByOrganizationId: string|null`, `splitPercentage: number|null`, `status: ASSIGNED|CONFIRMED_DONE`, `confirmedAt`, `proofUrl: string|null`, `assignedAt`
- **Repository**: `IErrandRepository` — `save`, `findById`, `findByClientId`, `findOpenErrands` (market/tier-filtered), `findAssignedPastStart`, `findInactiveOlderThan`
- **Errors**: `ErrandNotFoundError`, `ErrandInvariantError`, `ErrandNotOpenError`, `NotAllAssignmentsConfirmedError`

### Application
- **Commands**: `CreateErrandCommand`, `PublishErrandCommand`, `AssignErrandToTrustedMemberCommand`, `OfferErrandToTrustedMemberCommand`, `BookServiceCommand`, `StartErrandCommand`, `ConfirmAssignmentCompletionCommand`, `UpdateAssignmentConfirmationCommand`, `CompleteErrandCommand`, `CancelErrandCommand` *(deferred)*
- **Events**: `ErrandCreated`, `ErrandPublished`, `ErrandAssigned`, `ErrandStarted`, `AssignmentConfirmedDone`, `AssignmentConfirmationUpdated`, `ErrandReadyForCompletion`, `ErrandCompleted { completedBy }`, `ErrandArchived`, `ErrandCancelled` *(deferred)*
- **Jobs**: `ArchiveInactiveErrandsJob` (3 months inactivity → `ARCHIVED`), `AutoAcceptErrandJob` (24h delayed, scheduled on `ErrandReadyForCompletion`; idempotent no-op if already completed), `NoShowDetectionJob` *(deferred — needs cancel)*
- **Queries**: `BrowseOpenErrandsQuery` (geo-proximity + recency ranked, market/tier-filtered — see `docs/flows/errand-discovery-flow.md`), `GetErrandByIdQuery`, `ListClientErrandsQuery`, `SuggestReassignmentCandidatesQuery`
- **Sagas**: `ChatLifecycleSaga`, `RatingPromptSaga`, `EscrowReleaseSaga` (reclassified), `EscrowRefundSaga` (reclassified, deferred)

### Infrastructure
- **Mappers**: `ErrandMapper`
- **Repository impl**: `ErrandRepository`

---

## 7. application

### Domain
- **`Application`** — `id`, `errandId`, `applicantId` (Profile), `originType: BID|DIRECT_OFFER`, `status: PENDING|ACCEPTED|REJECTED`, `proposal`, `proposedAmount: Money`, `acceptedAt`, `rejectedAt`, `createdAt`, `updatedAt`
- **`AcceptApplicationProgress`** (entity, tracks the multi-step accept flow — see Decision Log #8) — `applicationId` (primary key), `errandId`, `correlationId`, `paymentTransactionId: string|null`, `status: CHARGE_INITIATED|CHARGE_FAILED|ACCEPTED|ERRAND_ASSIGNED|COMPLETED`, `createdAt`, `updatedAt`
- **Repository**: `IApplicationRepository` — `save`, `findById`, `findByErrandId`, `findPendingByErrandId`, `findByApplicantId`, `existsByErrandAndApplicant`; `IAcceptApplicationProgressRepository` — `save`, `findByApplicationId`
- **Errors**: `ApplicationInvariantError`, `ApplicationNotFoundError`, `DuplicateApplicationError`

### Application (layer)
- **Commands**: `SubmitApplicationCommand`, `RequestApplicationAcceptanceCommand` (true entry point — client for `BID`, offered member for `DIRECT_OFFER`), `AcceptApplicationCommand` (resume step, dispatched only by the processor below, never directly by a controller), `MarkApplicationAcceptanceFailedCommand`, `RejectApplicationCommand`, `RejectOtherApplicationsCommand`
- **Event Handlers**: `OnPaymentSucceededHandler`, `OnPaymentFailedHandler` — thin bridges; each looks up `AcceptApplicationProgress.findByApplicationId(event.purposeId)`, no-ops if not found (this is how a service-booking payment, which never created a progress row, is safely ignored), otherwise enqueues a job onto `accept-application-continue`
- **Processors**: `AcceptApplicationContinueProcessor` — one processor, two job names (`payment-succeeded`/`payment-failed`), dispatching `AcceptApplicationCommand`/`MarkApplicationAcceptanceFailedCommand` respectively; permanent failures dead-lettered
- **Queries**: `GetApplicationQuery`, `ListErrandApplicationsQuery`, `GetMyApplicationQuery`, `GetApplicationSummaryQuery`, `ListMyApplicationsQuery` — all authorized via `ApplicationAccessPolicy` (derives allowed access from the authenticated `userId`, never a client-claimed role)
- **Sagas**: `RejectOtherApplicationsSaga`

### Infrastructure
- **Mappers**: `ApplicationMapper`
- **Repository impl**: `ApplicationRepository`, `AcceptApplicationProgressRepository`

---

## 8. payment-gateway

### Domain
- **`PaymentTransaction`** — `id`, `clientId`, `purposeId` (an `applicationId` or errand-booking id — no `purposeType` needed, see Decision Log), `amount: Money`, `status: PENDING|SUCCEEDED|FAILED|REFUNDED`, `gatewayReference`, `method`, `failureReason`, `createdAt`, `updatedAt`
- **Repository**: `IPaymentTransactionRepository`
- **Errors**: `PaymentTransactionNotFoundError`, `GatewayTimeoutError`, `InvalidPaymentMethodError`

### Application
- **Commands**: `InitiateChargeCommand { clientId, purposeId, amount, paymentMethodId, correlationId }`, `RefundPaymentCommand`
- **Events**: `PaymentSucceeded`, `PaymentFailed`, `PaymentRefunded`
- **Jobs**: `GatewayReconciliationJob`
- **Event Handlers**: `EscrowRefunded` → `RefundPaymentCommand`
- **Queries**: `GetPaymentTransactionByIdQuery`, `FindByGatewayReferenceQuery`

### Infrastructure
- **Adapters**: `PaymentGatewayAdapter`, `WebhookVerifierAdapter`
- **Mappers**: `PaymentTransactionMapper`
- **Repository impl**: `PaymentTransactionRepository`

---

## 9. escrow

### Domain
- **`Escrow`** — `id`, `errandId`, `paymentTransactionId`, `amount: Money`, `status: HELD|RELEASED|REFUNDED`, `heldAt`, `releasedAt`, `refundedAt`, `createdAt`, `updatedAt`
- **Repository**: `IEscrowRepository`
- **Errors**: `EscrowNotFoundError`, `EscrowAlreadyFinalizedError`

### Application
- **Commands**: `CreateEscrowCommand`, `ReleaseEscrowCommand`, `RefundEscrowCommand`
- **Events**: `EscrowCreated`, `EscrowReleased`, `EscrowRefunded`
- **Jobs**: `EscrowAutoReleaseJob` (checks `Dispute.findOpen(errandId)` first — skips, no event, if one exists)
- **Event Handlers**: none of its own — `Escrow` is always explicitly commanded (`CreateEscrowCommand` from the accept-flow's resumed command, `ReleaseEscrowCommand`/`RefundEscrowCommand` from `DisputeResolutionSaga`), never triggered by listening to `PaymentSucceeded`/`DisputeResolved` directly. `EscrowAutoReleaseJob` *queries* `dispute` for an open dispute before firing — a read, not a subscription.
- **Queries**: `GetEscrowByErrandIdQuery`

### Infrastructure
- **Mappers**: `EscrowMapper`
- **Repository impl**: `EscrowRepository`

---

## 10. wallet

### Domain
- **`Wallet`** — `id`, `ownerId` (Profile, unique), `marketId` (implies currency), `balanceMinorUnits: number` (cached, derived from `Ledger`)
- **`Ledger`** (append-only, **the source of truth for all money movement**) — `id`, `walletId`, `type: CREDIT|DEBIT`, `amountMinorUnits`, `referenceType`, `referenceId`, `createdAt`
- **`Withdrawal`** — `id`, `walletId`, `amount: Money`, `status: PENDING|COMPLETED|FAILED`, `destinationBankAccountId`, `gatewayReference`, `createdAt`, `updatedAt`
- **`BankAccount`** — `id`, `ownerId` (Profile), `marketId`, `bankCode`, `accountNumber`, `accountName` (resolved via gateway, never user-entered), `isVerified: boolean`, `isDefault`, `createdAt`, `updatedAt`
- **Repositories**: `IWalletRepository`, `ILedgerRepository`, `IWithdrawalRepository`, `IBankAccountRepository`
- **Errors**: `InsufficientBalanceError`, `WalletNotFoundError`, `WithdrawalNotFoundError`, `BankAccountNotFoundError`, `BankAccountNotVerifiedError`, `BankAccountMarketMismatchError`

### Application
- **Commands**: `RequestWithdrawalCommand`, `AddBankAccountCommand`, `RemoveBankAccountCommand`, `SetDefaultBankAccountCommand`
- **Events**: `WalletCredited`, `WalletDebited`, `WithdrawalRequested`, `WithdrawalCompleted`, `WithdrawalFailed`, `BankAccountAdded`, `BankAccountVerified`, `BankAccountVerificationFailed`
- **Jobs**: `LedgerReconciliationJob` (verifies `Wallet.balanceMinorUnits` against summed `Ledger` entries), `StuckWithdrawalSweepJob` (flags `PENDING` past a configurable threshold, default 6h — flags for ops review, does not auto-resolve)
- **Event Handlers**: `EscrowReleased` → payout split (see below) → one or more `Wallet.credit()` calls
- **Processors**: `WithdrawalContinueProcessor` (mirrors `AcceptApplicationContinueProcessor`'s shape — bridge handler enqueues, processor resumes via `Withdrawal.status`, **no auto-retry on failure**, just a compensating credit + notify), `BankAccountResolutionProcessor` (async verification, save-first-verify-after)
- **Queries**: `GetWalletBalanceQuery`, `ListLedgerEntriesQuery`

**Payout split** (on `EscrowReleased`, for organization applicants with multiple `ErrandAssignment`s): proportional split using the **Largest Remainder Method** to guarantee minor-unit-exact totals (no rounding drift) — worth implementing as a shared `splitProportionally(total, weights[])` utility. See `docs/flows/errand-completion-flow.md`.

### Infrastructure
- **Adapters**: `BankTransferAdapter`, `BankAccountResolverAdapter`
- **Mappers**: `WalletMapper`, `LedgerMapper`, `WithdrawalMapper`, `BankAccountMapper`
- **Repository impls**: `WalletRepository`, `LedgerRepository`, `WithdrawalRepository`, `BankAccountRepository`

---

## 11. chat

### Domain
- **`ChatThread`** (aggregate root) — `id`, `errandId`, `participantIds: string[]`, `createdAt`, `closedAt`, `firstResponseAt: Date|null`
- **`ChatMessage`** (its own small collection/entity, **not embedded** in `ChatThread` — see `docs/modules/chat.md`: chat volume is unbounded, embedding risks MongoDB's document-size limit) — `id`, `threadId`, `senderId`, `content`, `sentAt`
- **Repository**: `IChatThreadRepository`
- **Errors**: `ChatThreadNotFoundError`, `ChatThreadClosedError`

### Application
- **Commands**: `SendMessageCommand`
- **Events**: `ChatThreadOpened`, `MessageSent`, `ChatThreadClosed`, `ProviderRespondedFirstTime`
- **Queries**: `GetChatThreadByErrandIdQuery`, `ListMessagesQuery`

### Infrastructure
- **Adapters**: `RealtimeMessagingAdapter`
- **Mappers**: `ChatThreadMapper`, `ChatMessageMapper`
- **Repository impl**: `ChatThreadRepository`

---

## 12. rating

### Domain
- **`Rating`** — `id`, `errandId`, `raterId`, `rateeId`, `context: CLIENT_FACING|INTERNAL`, `score: 1-5`, `comment: string|null` (CLIENT_FACING only), `createdAt`
- **Repository**: `IRatingRepository` — `save`, `findById`, `findByRateeId`, unique per `(errandId, raterId, rateeId, context)`
- **Errors**: `RatingAlreadySubmittedError`, `RatingNotAllowedError`

### Application
- **Commands**: `SubmitRatingCommand`
- **Events**: `RatingSubmitted`
- **Queries**: `GetAverageRatingByRateeQuery`, `ListRatingsForRateeQuery`

Recency-weighted average: `weight = 0.5 ^ (ageInDays / halfLifeDays)`, half-life ~180 days (tunable). Recomputed immediately on submit (CLIENT_FACING only) + swept nightly by `ProfileRatingRecalcJob` (owned in `profile`).

### Infrastructure
- **Mappers**: `RatingMapper`
- **Repository impl**: `RatingRepository`

---

## 13. trusted-circle

### Domain
- **`TrustedCircle`** (aggregate root, one per client `Profile`) — `id`, `ownerProfileId` (unique), `createdAt`, `updatedAt`
- **`TrustedCircleMember`** (entity) — `id`, `memberId` (Profile — no type field needed), `status: CONFIRMED|SUGGESTED`, `sharedFromProfileId: string|null`, `addedAt`
- **Repository**: `ITrustedCircleRepository` — `save`, `findByOwnerProfileId`, `existsByOwnerAndMember`, `countMutualTrust`, `findOwnersWhoTrust(profileId)`
- **Errors**: `TrustedCircleNotFoundError`, `MemberAlreadyInCircleError`, `SuggestionNotFoundError`

### Application
- **Commands**: `AddTrustedMemberCommand`, `RemoveTrustedMemberCommand`, `ShareTrustedMemberCommand`, `ConfirmSharedMemberCommand`, `DeclineSharedMemberCommand`
- **Events**: `TrustedCircleMemberAdded`, `TrustedCircleMemberShareSuggested`, `TrustedCircleMemberConfirmed`, `TrustedCircleMemberDeclined`, `TrustedCircleMemberRemoved`
- **Queries**: `GetTrustedCircleByProfileQuery`, `CountMutualTrustQuery` (hash-set intersection — see `docs/flows/trusted-circle-flow.md`), `ListPendingSuggestionsQuery`
- **Sagas**: `TrustedByCountSyncSaga` (trigger lives here; consumer is `profile`)

### Infrastructure
- **Mappers**: `TrustedCircleMapper`, `TrustedCircleMemberMapper`
- **Repository impl**: `TrustedCircleRepository`

---

## 14. dispute

### Domain
- **`Dispute`** — `id`, `errandId`, `raisedById`, `reason`, `description`, `status: OPEN|UNDER_REVIEW|RESOLVED|REJECTED`, `resolution`, `resolvedById` (better-auth admin id), `resolvedAt`, `createdAt`, `updatedAt`
- **Repository**: `IDisputeRepository`
- **Errors**: `DisputeNotFoundError`, `DisputeAlreadyResolvedError`, `ErrandNotEligibleForDisputeError` (thrown unless `Errand.status = COMPLETED`)

### Application
- **Commands**: `OpenDisputeCommand`, `AssignReviewerCommand`, `ResolveDisputeCommand`, `RejectDisputeCommand` — all admin-side commands permission-checked against better-auth's `dispute` resource
- **Events**: `DisputeOpened`, `DisputeUnderReview`, `DisputeResolved`, `DisputeRejected`
- **Queries**: `GetDisputeByIdQuery`, `ListOpenDisputesQuery`
- **Sagas**: `DisputeResolutionSaga` (reclassified — single conditional hop, no compensation)

### Infrastructure
- **Adapters**: `DocumentStorageAdapter`
- **Mappers**: `DisputeMapper`
- **Repository impl**: `DisputeRepository`

---

## 15. notification

### Domain
- **`NotificationLog`** — `id`, `userId`, `type`, `channel: EMAIL|SMS|PUSH`, `payload`, `status: SENT|FAILED`, `createdAt`
- **`NotificationPreference`** — `id`, `userId` (unique), `emailEnabled`, `smsEnabled`, `pushEnabled` (each boolean, default true)
- **Repositories**: `INotificationLogRepository`, `INotificationPreferenceRepository`
- **Errors**: `NotificationDeliveryError`

### Application
- **Commands**: `SendNotificationCommand` (checks `NotificationPreference` per channel before dispatch — open item: whether critical sends like OTPs should bypass muting), `UpdateNotificationPreferenceCommand`
- **Events**: `NotificationSent`, `NotificationFailed`
- **Jobs**: `RetryFailedNotificationsJob`
- **Event Handlers**: near-universal sink — representative subset: `ProfileCreated`, `ApplicationSubmitted`, `ApplicationAccepted`, `ErrandAssigned`, `ErrandCompleted`, `PaymentFailed`, `WithdrawalCompleted`/`Failed`, `VerificationCompleted`, `DisputeOpened`/`Resolved`, `MessageSent`, `TrustedCircleMemberShareSuggested`, `RatingSubmitted`
- **Queries**: `ListNotificationsByUserQuery`

### Infrastructure
- **Adapters**: `EmailAdapter`, `SmsAdapter`, `PushNotificationAdapter`
- **Mappers**: `NotificationLogMapper`
- **Repository impl**: `NotificationLogRepository`, `NotificationPreferenceRepository`

---

## Remaining open items

- **Cancel** (`Application.cancel()`, `Errand.cancel()`) — still deferred; `NoShowDetectionJob` and `EscrowRefundSaga` depend on it.
- **`sourceType` mutability** — does a declined `TRUSTED_DIRECT_ASSIGN` errand that gets published keep its origin tag, or reclassify as `OPEN_BID`? Leaning toward keeping it immutable (status changes, origin doesn't), not formally decided.
- **Notification bypass** — should OTP/critical sends ignore `NotificationPreference` muting? Not decided.
- **Dispute-window relative to `completedBy`** — does an auto-accepted (`SYSTEM`) completion deserve a longer dispute window than an actively client-confirmed one? Not decided.
- **better-auth `before`-hook abort behavior** — needs verifying against the current version before relying on it for market enforcement at signup (see `docs/flows/user-registration-flow.md`).

See `docs/flows/` for the full set of sequence-level flow documents, and `docs/flows/patterns-index.md` for the EIP/DDD pattern cross-reference.
