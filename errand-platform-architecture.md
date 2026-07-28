# Errand Platform — Module Architecture Reference

This document consolidates every module: domain layer (entities, value objects, repositories, events, errors), application layer (commands, jobs, events, queries, sagas), and infrastructure layer (adapters, mappers, repository implementations) — including field-level detail on entities, command/event payloads, and correlation-id propagation.

Clusters, for orientation:
- **Identity & access**: users, client, provider, organizations, address, verification
- **Marketplace core**: service, errands, application
- **Money & escrow**: payment-gateway, escrow, wallet
- **Trust & social**: chat, rating, trusted-circle
- **Support**: dispute, notification

Decisions locked in:
1. Client requires only email + phone confirmation (via `User`) — no separate `VerificationProfile`.
2. Cancel (`Application.cancel()`, `Errand.cancel()`) remains deferred.
3. **Sagas live in the module that raises the triggering event** — not the module they call into. A saga reacting to `ErrandCompleted` lives in `errands`, even though it dispatches commands into `escrow`/`rating`/`wallet`. Where a process manager is instead kicked off directly by a top-level user command (not by reacting to another module's event), it lives wherever that command naturally belongs.

## Correlation ID convention

- A **fresh `correlationId`** is generated once, at the top-level command that starts a business transaction (e.g. `AcceptApplicationCommand`, `CompleteErrandCommand`, `RequestWithdrawalCommand`).
- It is threaded through **every event and every cascading command that fires synchronously/immediately as a direct consequence** of that top-level command, across however many modules the cascade touches.
- It **stops** once the cascade has no further direct consequences — i.e., once execution reaches a module that only records/notifies (typically `notification`) or a terminal state with nothing left to trigger.
- **Arbitrary-delay workflows do not share a `correlationId` across their steps.** If real time can pass between two steps because a *different actor* has to act (e.g. a share-suggestion waiting on the recipient to confirm, or a completed errand waiting on a rating), the second step is its own new transaction with its own fresh `correlationId`. Continuity across the delay is tracked with a **persistent reference id** stored on the record itself (e.g. `sharedFromClientId`), not with `correlationId`.
- **`causationId`** (optional, only where the causal parent isn't already obvious from context) = the id of the specific event that directly caused this one. Most flows in this system have only one plausible parent per step, so `causationId` is rarely needed beyond `correlationId` — call it out per-event below only where it adds real value.

---

## 1. users

### Domain
- **`User`** (aggregate root) — `id`, `email`, `phone`, `passwordHash`, `status: ACTIVE|SUSPENDED|DELETED`, `emailConfirmedAt: Date|null`, `phoneConfirmedAt: Date|null`, `createdAt`, `updatedAt`
- **Repository**: `IUserRepository` — `save`, `findById`, `findByEmail`, `findByPhone`
- **Errors**: `UserAlreadyExistsError`, `InvalidCredentialsError`, `UserSuspendedError`, `EmailAlreadyConfirmedError`

### Application
- **Commands**
  - `RegisterUserCommand { email, phone, password }`
  - `ChangePasswordCommand { userId, currentPassword, newPassword }`
  - `SuspendUserCommand { userId, reason }`
  - `ConfirmEmailCommand { userId, token }`
  - `ConfirmPhoneCommand { userId, otp }`
- **Events** *(each command above generates its own fresh `correlationId`; these events terminate at Notification — nothing cascades further)*
  - `UserRegistered { userId, email, phone, correlationId }`
  - `UserSuspended { userId, reason, correlationId }`
  - `EmailConfirmed { userId, correlationId }`
  - `PhoneConfirmed { userId, correlationId }`
- **Jobs**: none required yet
- **Queries**: `GetUserByIdQuery`, `GetUserByEmailQuery`
- **Sagas**: none

### Infrastructure
- **Adapters**: `PasswordHasherAdapter`, `EmailConfirmationTokenAdapter`
- **Mappers**: `UserMapper`
- **Repository impl**: `UserRepository`

---

## 2. client

### Domain
- **`Client`** — `id`, `userId`, `createdAt`, `updatedAt`
- **Repository**: `IClientRepository` — `save`, `findById`, `findByUserId`
- **Errors**: `ClientProfileAlreadyExistsError`, `ClientNotFoundError`

### Application
- **Commands**: `CreateClientProfileCommand { userId }`
- **Events**: `ClientProfileCreated { clientId, userId, correlationId }` — fresh id, stops at Notification.
- **Queries**: `GetClientByIdQuery`, `GetClientByUserIdQuery`
- **Sagas**: none

### Infrastructure
- **Mappers**: `ClientMapper`
- **Repository impl**: `ClientRepository`

---

## 3. provider

### Domain
- **`Provider`** — `id`, `userId`, `organizationId: OrganizationId|null`, `workerType: CASUAL|ARTISAN|PROFESSIONAL`, `bio`, `skills: string[]`, `verificationStatus: boolean`, `trustedByCount: number`, `completedErrandsCount: number`, `disputedErrandsCount: number`, `avgResponseTimeSeconds: number|null`, `isActive`, `createdAt`, `updatedAt`
- **Repository**: `IProviderRepository` — `save`, `findById`, `findByUserId`
- **Errors**: `ProviderProfileAlreadyExistsError`, `ProviderNotFoundError`, `ProviderNotVerifiedError`

### Application
- **Commands**
  - `CreateProviderProfileCommand { userId, workerType, bio, skills }`
  - `UpdateProviderProfileCommand { providerId, bio?, skills? }`
  - `DeactivateProviderCommand { providerId }`
  - `JoinOrganizationCommand { providerId, organizationId }`
  - `LeaveOrganizationCommand { providerId }`
- **Events**
  - `ProviderProfileCreated { providerId, userId, workerType, correlationId }`
  - `ProviderJoinedOrganization { providerId, organizationId, correlationId }`
  - `ProviderLeftOrganization { providerId, correlationId }`
- **Jobs**: `ProviderResponseTimeRecalcJob` (nightly; recomputes `avgResponseTimeSeconds` from `chat`'s `firstResponseAt` data; not correlationId-bearing, it's a batch recompute)
- **Events consumed** *(each carries whatever correlationId the source event had — this module is a pure projection target here, so the chain simply passes through and typically ends)*
  - `VerificationCompleted` → set `verificationStatus = true`
  - `TrustedCircleMemberConfirmed` / `TrustedCircleMemberRemoved` → adjust `trustedByCount`
  - `ErrandCompleted` → increment `completedErrandsCount`
  - `DisputeOpened` → increment `disputedErrandsCount`
- **Queries**: `GetProviderByIdQuery`, `GetProviderPublicProfileQuery`, `SearchProvidersByServiceQuery`
- **Sagas**: none

### Infrastructure
- **Mappers**: `ProviderMapper`
- **Repository impl**: `ProviderRepository`

---

## 4. organizations

### Domain
- **`Organization`** — `id`, `ownerUserId`, `name`, `businessRegistrationNumber`, `verificationStatus: boolean`, `createdAt`, `updatedAt`
- **Repository**: `IOrganizationRepository` — `save`, `findById`, `findByOwnerUserId`, `findMembers(orgId)`
- **Errors**: `OrganizationNotFoundError`, `MemberAlreadyInOrganizationError`, `MemberNotInOrganizationError`

### Application
- **Commands**
  - `CreateOrganizationCommand { ownerUserId, name, businessRegistrationNumber }`
  - `AddOrganizationMemberCommand { organizationId, providerId }`
  - `RemoveOrganizationMemberCommand { organizationId, providerId }`
  - `AssignMemberToErrandCommand { organizationId, errandId, providerId }`
- **Events**
  - `OrganizationCreated { organizationId, ownerUserId, correlationId }`
  - `OrganizationMemberAdded { organizationId, providerId, correlationId }`
  - `OrganizationMemberRemoved { organizationId, providerId, correlationId }`
- **Events consumed**: `VerificationCompleted` → set org-level `verificationStatus`
- **Queries**: `GetOrganizationByIdQuery`, `ListOrganizationMembersQuery`
- **Sagas**: none

### Infrastructure
- **Mappers**: `OrganizationMapper`
- **Repository impl**: `OrganizationRepository`

---

## 5. address

### Domain
- **`Address`** — `id`, `ownerUserId`, `label`, `street`, `city`, `state`, `country`, `latitude`, `longitude`, `isDefault`, `createdAt`, `updatedAt`
- **Value Objects**: `Coordinates { latitude, longitude }`
- **Repository**: `IAddressRepository` — `save`, `findById`, `findByUserId`
- **Errors**: `AddressNotFoundError`

### Application
- **Commands**
  - `CreateAddressCommand { ownerUserId, label, street, city, state, country }`
  - `UpdateAddressCommand { addressId, label?, street?, city?, state?, country? }`
  - `SetDefaultAddressCommand { addressId }`
  - `DeleteAddressCommand { addressId }`
- **Events**
  - `AddressCreated { addressId, ownerUserId, correlationId }`
  - `AddressUpdated { addressId, correlationId }`
  - `DefaultAddressChanged { ownerUserId, addressId, correlationId }`
- **Queries**: `GetAddressByIdQuery`, `ListAddressesByUserQuery`
- **Sagas**: none

### Infrastructure
- **Adapters**: `GeocodingAdapter`
- **Mappers**: `AddressMapper`
- **Repository impl**: `AddressRepository`

---

## 6. verification

### Domain
- **`VerificationProfile`** (aggregate root) — `id`, `subjectType: PROVIDER|ORGANIZATION`, `subjectId`, `workerType: WorkerType|null`, `requiredSteps: StepType[]`, `overallStatus: INCOMPLETE|COMPLETE`, `createdAt`, `updatedAt`
- **`VerificationStep`** (entity within) — `id`, `stepType: NIN_VERIFIED|LICENSE_VERIFIED|BUSINESS_REG_VERIFIED`, `status: PENDING|SUBMITTED|APPROVED|REJECTED`, `documentUrls: string[]`, `submittedAt`, `reviewedAt`, `reviewerId`, `rejectionReason`
- **Repository**: `IVerificationProfileRepository` — `save`, `findById`, `findBySubject(subjectType, subjectId)`, `findPendingSteps()`
- **Errors**: `VerificationProfileNotFoundError`, `StepAlreadyApprovedError`, `MissingRequiredDocumentsError`

Note: email/phone confirmation are *not* steps here — they live on `User`. A Client or Casual provider may have no `VerificationProfile` at all.

### Application
- **Commands**
  - `SubmitVerificationStepCommand { subjectType, subjectId, stepType, documentUrls }`
  - `ApproveVerificationStepCommand { verificationProfileId, stepType, reviewerId }`
  - `RejectVerificationStepCommand { verificationProfileId, stepType, reviewerId, reason }`
- **Events**
  - `VerificationStepSubmitted { verificationProfileId, stepType, correlationId }`
  - `VerificationStepApproved { verificationProfileId, stepType, reviewerId, correlationId }`
  - `VerificationStepRejected { verificationProfileId, stepType, reviewerId, reason, correlationId }`
  - `VerificationCompleted { subjectType, subjectId, correlationId }` — same `correlationId` as whichever `approveStep()` call completed the last requirement; carries through to the Provider/Organization cached-field update, then stops.
- **Jobs**: `AutoKYCCheckJob`
- **Queries**: `GetVerificationProfileBySubjectQuery`, `ListPendingVerificationStepsQuery`
- **Sagas**: `AutoKYCReviewProcessManager` — `VerificationStepSubmitted` (fresh `correlationId` from the submit command) → external API call → `approveStep()`/`rejectStep()`, reusing that same id.

### Infrastructure
- **Adapters**: `NINVerificationApiAdapter`, `LicenseVerificationApiAdapter`, `DocumentStorageAdapter`
- **Mappers**: `VerificationProfileMapper`
- **Repository impl**: `VerificationProfileRepository`

---

## 7. service

### Domain
- **`Service`** — `id`, `listedById`, `listedByType: PROVIDER|ORGANIZATION`, `title`, `description`, `category`, `priceKobo`, `currency`, `isActive`, `createdAt`, `updatedAt`
- **Repository**: `IServiceRepository` — `save`, `findById`, `findByListerId`, `findActiveByCategory`
- **Errors**: `ServiceNotFoundError`, `ServiceNotOwnedByListerError`

### Application
- **Commands**
  - `ListServiceCommand { listedById, listedByType, title, description, category, priceKobo, currency }`
  - `UpdateServicePriceCommand { serviceId, priceKobo }`
  - `DeactivateServiceCommand { serviceId }`
- **Events**
  - `ServiceListed { serviceId, listedById, correlationId }`
  - `ServiceDeactivated { serviceId, correlationId }`
- **Queries**: `SearchServicesQuery`, `GetServiceByIdQuery`
- **Sagas**: none — the verification gate is a synchronous check inside `ListServiceCommand`'s handler, not an event reaction.

### Infrastructure
- **Mappers**: `ServiceMapper`
- **Repository impl**: `ServiceRepository`

---

## 8. errands

### Domain
- **`Errand`** — `id`, `clientId`, `serviceId: ServiceId|null`, `title`, `description`, `addressId`, `budgetKobo`, `currency`, `status: DRAFT|PUBLISHED|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED`, `sourceType: OPEN_BID|TRUSTED_DIRECT_ASSIGN|SERVICE_BOOKING`, `acceptedApplicationId: ApplicationId|null`, `startedAt`, `completedAt`, `cancelledAt`, `relistedFromErrandId: ErrandId|null`, `createdAt`, `updatedAt`
- **Repository**: `IErrandRepository` — `save`, `findById`, `findByClientId`, `findOpenErrands`, `findAssignedPastStart`
- **Errors**: `ErrandNotFoundError`, `ErrandInvariantError`, `ErrandNotOpenError`

### Application
- **Commands**
  - `CreateErrandCommand { clientId, title, description, addressId, budgetKobo, currency }`
  - `PublishErrandCommand { errandId }`
  - `AssignErrandToTrustedMemberCommand { clientId, title, description, addressId, budgetKobo, currency, trustedMemberId, trustedMemberType }`
  - `BookServiceCommand { clientId, serviceId, addressId }`
  - `StartErrandCommand { errandId, providerId }`
  - `CompleteErrandCommand { errandId }`
- **Events**
  - `ErrandCreated { errandId, clientId, sourceType, correlationId }`
  - `ErrandPublished { errandId, correlationId }`
  - `ErrandAssigned { errandId, acceptedApplicationId, correlationId }`
  - `ErrandStarted { errandId, correlationId }`
  - `ErrandCompleted { errandId, correlationId }`
  - `ErrandCancelled { errandId, reason, correlationId }` *(deferred)*
- **Jobs**: `StaleDraftCleanupJob`, `NoShowDetectionJob` *(deferred)*
- **Queries**: `BrowseOpenErrandsQuery`, `GetErrandByIdQuery`, `ListClientErrandsQuery`
- **Sagas** — placed here as the trigger module for the events they react to:
  - **`AcceptApplicationProcessManager`** *(kicked off by `AcceptApplicationCommand`, which lives in `application` — this saga is invoked by that command handler, not by an event, so it's really jointly owned; implementation-wise it's fine to keep it beside `Application` since that's the command's home)* — see full chain under `application` below.
  - **`ChatLifecycleSaga`** — `ErrandAssigned` → `ChatThread.open()`; `ErrandCompleted`/`ErrandCancelled` → `ChatThread.close()`. Same `correlationId` as the triggering errand event.
  - **`RatingPromptSaga`** *(moved here per trigger-module convention — `ErrandCompleted` is raised by `errands`, not `rating`)* — `ErrandCompleted` → dispatch notifications prompting both parties to rate. Same `correlationId`.
  - **`EscrowReleaseProcessManager`** *(moved here — triggered by `ErrandCompleted`)* — `ErrandCompleted` → `Escrow.release()` → `Wallet.credit()`. Same `correlationId` throughout; stops once `WalletCredited` fires.
  - **`EscrowRefundProcessManager`** *(moved here — triggered by `ErrandCancelled`, deferred)* — `ErrandCancelled` → `Escrow.refund()` → `PaymentTransaction.refund()`. Same `correlationId`.

### Infrastructure
- **Mappers**: `ErrandMapper`
- **Repository impl**: `ErrandRepository`

---

## 9. application

### Domain
- **`Application`** — `id`, `errandId`, `applicantType: PROVIDER|ORGANIZATION`, `applicantId`, `status: PENDING|ACCEPTED|REJECTED`, `proposal`, `proposedAmountKobo`, `currency`, `acceptedAt`, `rejectedAt`, `createdAt`, `updatedAt`
- **Repository**: `IApplicationRepository` — `save`, `findById`, `findByErrandId`, `findPendingByErrandId`, `findByApplicantId`, `existsByErrandAndApplicant`
- **Errors**: `ApplicationInvariantError`, `ApplicationNotFoundError`, `DuplicateApplicationError`

### Application (layer)
- **Commands**
  - `SubmitApplicationCommand { errandId, applicantType, applicantId, proposal, proposedAmountKobo, currency }`
  - `AcceptApplicationCommand { applicationId, clientId }` — **this is the root of the widest correlation chain in the system.**
  - `RejectApplicationCommand { applicationId, clientId }`
  - `RejectOtherApplicationsCommand { errandId, acceptedApplicationId, correlationId }` — internal, issued only by the saga below, always carrying a passed-in `correlationId` rather than generating one.
- **Events**
  - `ApplicationSubmitted { applicationId, errandId, applicantId, correlationId }`
  - `ApplicationAccepted { applicationId, errandId, applicantId, correlationId }`
  - `ApplicationRejected { applicationId, errandId, correlationId }`
- **Sagas**
  - **`AcceptApplicationProcessManager`** — `AcceptApplicationCommand` generates a fresh `correlationId`, then: `PaymentTransaction.initiate()` → on `PaymentSucceeded` (same id) → `Application.accept()` (→ `ApplicationAccepted`, same id) → `Errand.assignTo()` (→ `ErrandAssigned`, same id) → `Escrow.create()` (→ `EscrowCreated`, same id) → `ChatThread.open()` (same id). On `PaymentFailed`, the chain stops immediately — nothing else is touched, and the client's retry is a **brand-new** `correlationId`.
  - **`RejectOtherApplicationsSaga`** — reads `correlationId` directly off the `ApplicationAccepted` event and passes it into every `RejectOtherApplicationsCommand`/`reject()` call, so all sibling rejections share the same id as the acceptance that caused them.

### Infrastructure
- **Mappers**: `ApplicationMapper`
- **Repository impl**: `ApplicationRepository`

---

## 10. payment-gateway

### Domain
- **`PaymentTransaction`** — `id`, `clientId`, `purposeType: APPLICATION_ACCEPT|SERVICE_BOOKING`, `purposeId`, `amountKobo`, `currency`, `status: PENDING|SUCCEEDED|FAILED|REFUNDED`, `gatewayReference`, `method`, `failureReason`, `createdAt`, `updatedAt`
- **Repository**: `IPaymentTransactionRepository` — `save`, `findById`, `findByGatewayReference`, `findByPurposeId`
- **Errors**: `PaymentTransactionNotFoundError`, `GatewayTimeoutError`, `InvalidPaymentMethodError`

### Application
- **Commands**
  - `InitiateChargeCommand { clientId, purposeType, purposeId, amountKobo, currency, paymentMethodId, correlationId }` — always receives the caller's `correlationId`, never generates its own.
  - `RefundPaymentCommand { paymentTransactionId, correlationId }`
- **Events**
  - `PaymentSucceeded { paymentTransactionId, purposeType, purposeId, amountKobo, correlationId }`
  - `PaymentFailed { paymentTransactionId, purposeId, reason, correlationId }` — chain stops here.
  - `PaymentRefunded { paymentTransactionId, correlationId }`
- **Jobs**: `GatewayReconciliationJob`
- **Events consumed**: `EscrowRefunded` → `RefundPaymentCommand` (same `correlationId` as the refund chain)
- **Queries**: `GetPaymentTransactionByIdQuery`, `FindByGatewayReferenceQuery`
- **Sagas**: none

### Infrastructure
- **Adapters**: `PaymentGatewayAdapter`, `WebhookVerifierAdapter`
- **Mappers**: `PaymentTransactionMapper`
- **Repository impl**: `PaymentTransactionRepository`

---

## 11. escrow

### Domain
- **`Escrow`** — `id`, `errandId`, `paymentTransactionId`, `amountKobo`, `currency`, `status: HELD|RELEASED|REFUNDED`, `heldAt`, `releasedAt`, `refundedAt`, `releasedToWalletId`, `createdAt`, `updatedAt`
- **Repository**: `IEscrowRepository` — `save`, `findById`, `findByErrandId`
- **Errors**: `EscrowNotFoundError`, `EscrowAlreadyFinalizedError`

### Application
- **Commands**
  - `CreateEscrowCommand { errandId, paymentTransactionId, amountKobo, currency, correlationId }`
  - `ReleaseEscrowCommand { escrowId, correlationId }`
  - `RefundEscrowCommand { escrowId, correlationId }`
- **Events**
  - `EscrowCreated { escrowId, errandId, amountKobo, correlationId }`
  - `EscrowReleased { escrowId, errandId, walletId, amountKobo, correlationId }`
  - `EscrowRefunded { escrowId, errandId, correlationId }`
- **Jobs**: `EscrowAutoReleaseJob`
- **Events consumed**: `PaymentSucceeded` (create), `DisputeOpened` (suppress auto-release), `DisputeResolved` (release or refund, per resolution — `correlationId` inherited from the dispute-resolution chain)
- **Queries**: `GetEscrowByErrandIdQuery`
- **Sagas**: none of its own — reacted to by `errands`' and `dispute`'s process managers, per the trigger-module convention.

### Infrastructure
- **Mappers**: `EscrowMapper`
- **Repository impl**: `EscrowRepository`

---

## 12. wallet

### Domain
- **`Wallet`** — `id`, `ownerId`, `ownerType: PROVIDER|ORGANIZATION`, `balanceKobo`, `currency`, `createdAt`, `updatedAt`
- **`WalletTransaction`** (ledger entity) — `id`, `walletId`, `type: CREDIT|DEBIT`, `amountKobo`, `referenceType`, `referenceId`, `createdAt`
- **`Withdrawal`** — `id`, `walletId`, `amountKobo`, `currency`, `status: PENDING|COMPLETED|FAILED`, `destinationBankAccountId`, `gatewayReference`, `createdAt`, `updatedAt`
- **Repositories**: `IWalletRepository`, `IWalletTransactionRepository`, `IWithdrawalRepository`
- **Errors**: `InsufficientBalanceError`, `WalletNotFoundError`, `WithdrawalNotFoundError`

### Application
- **Commands**: `RequestWithdrawalCommand { walletId, amountKobo, destinationBankAccountId }` — generates a fresh `correlationId`.
- **Events**
  - `WalletCredited { walletId, amountKobo, referenceId, correlationId }` — inherits the id of whichever chain credited it (e.g. the `CompleteErrandCommand` chain via `EscrowReleased`, or a withdrawal-failure compensation).
  - `WalletDebited { walletId, amountKobo, referenceId, correlationId }`
  - `WithdrawalRequested { withdrawalId, walletId, amountKobo, correlationId }`
  - `WithdrawalCompleted { withdrawalId, correlationId }`
  - `WithdrawalFailed { withdrawalId, reason, correlationId }`
- **Jobs**: `StuckWithdrawalSweepJob`
- **Events consumed**: `EscrowReleased` → `Wallet.credit()`
- **Queries**: `GetWalletBalanceQuery`, `ListWalletTransactionsQuery`
- **Sagas**: **`WithdrawalProcessManager`** — `RequestWithdrawalCommand`'s `correlationId` carries through: immediate `WalletDebited` → `WithdrawalRequested` → payout adapter call → `WithdrawalCompleted`, or `WithdrawalFailed` + a compensating `WalletCredited` (same id). Stops after either outcome.

### Infrastructure
- **Adapters**: `BankTransferAdapter`
- **Mappers**: `WalletMapper`, `WalletTransactionMapper`, `WithdrawalMapper`
- **Repository impls**: `WalletRepository`, `WalletTransactionRepository`, `WithdrawalRepository`

---

## 13. chat

### Domain
- **`ChatThread`** (aggregate root) — `id`, `errandId`, `participantIds: string[]`, `createdAt`, `closedAt`, `firstResponseAt: Date|null`
- **`ChatMessage`** (entity within) — `id`, `threadId`, `senderId`, `content`, `sentAt`
- **Repository**: `IChatThreadRepository` — `save`, `findById`, `findByErrandId`
- **Errors**: `ChatThreadNotFoundError`, `ChatThreadClosedError`

### Application
- **Commands**: `SendMessageCommand { threadId, senderId, content }` — standalone user action, own fresh `correlationId` each time (chat messages aren't part of a bigger saga).
- **Events**
  - `ChatThreadOpened { threadId, errandId, correlationId }` — inherits the id from the `AcceptApplicationCommand`/`BookServiceCommand`/trusted-assign chain that produced `ErrandAssigned`.
  - `MessageSent { threadId, senderId, correlationId }`
  - `ChatThreadClosed { threadId, correlationId }` — inherits the id from the `CompleteErrandCommand`/cancel chain.
  - `ProviderRespondedFirstTime { threadId, providerId, responseTimeSeconds, correlationId }`
- **Queries**: `GetChatThreadByErrandIdQuery`, `ListMessagesQuery`
- **Sagas**: none owned here — `ChatLifecycleSaga` lives in `errands` per the trigger-module rule.

### Infrastructure
- **Adapters**: `RealtimeMessagingAdapter`
- **Mappers**: `ChatThreadMapper`, `ChatMessageMapper`
- **Repository impl**: `ChatThreadRepository`

---

## 14. rating

### Domain
- **`Rating`** — `id`, `errandId`, `raterId`, `raterType`, `rateeId`, `rateeType`, `score: 1-5`, `comment`, `createdAt`
- **Repository**: `IRatingRepository` — `save`, `findById`, `findByRateeId`
- **Errors**: `RatingAlreadySubmittedError`, `RatingNotAllowedError`

### Application
- **Commands**: `SubmitRatingCommand { errandId, raterId, raterType, rateeId, rateeType, score, comment }` — this is a standalone later action (arbitrary delay after completion), so it gets its **own fresh `correlationId`**, not the one from `CompleteErrandCommand`.
- **Events**: `RatingSubmitted { ratingId, errandId, rateeId, score, correlationId }`
- **Queries**: `GetAverageRatingByRateeQuery`, `ListRatingsForRateeQuery`
- **Sagas**: none owned here — the *prompt* to rate (`RatingPromptSaga`) lives in `errands`, since it's a direct synchronous consequence of `ErrandCompleted`.

### Infrastructure
- **Mappers**: `RatingMapper`
- **Repository impl**: `RatingRepository`

---

## 15. trusted-circle

### Domain
- **`TrustedCircle`** (aggregate root, exactly one per client) — `id`, `ownerClientId` (unique), `createdAt`, `updatedAt`
- **`TrustedCircleMember`** (entity within) — `id`, `memberId`, `memberType: PROVIDER|ORGANIZATION`, `status: CONFIRMED|SUGGESTED`, `sharedFromClientId: ClientId|null`, `addedAt`
- **Repository**: `ITrustedCircleRepository` — `save`, `findByOwnerClientId`, `existsByOwnerAndMember`, `countMutualTrust(viewingClientId, providerId)`
- **Errors**: `TrustedCircleNotFoundError`, `MemberAlreadyInCircleError`, `SuggestionNotFoundError`

### Application
- **Commands**
  - `AddTrustedMemberCommand { ownerClientId, memberId, memberType }`
  - `RemoveTrustedMemberCommand { ownerClientId, memberId }`
  - `ShareTrustedMemberCommand { sharerClientId, memberId, targetClientId }` — loads sharer's circle to verify the member is `CONFIRMED` there, then only ever mutates the **target's** circle via `receiveSuggestion()`.
  - `ConfirmSharedMemberCommand { targetClientId, memberEntryId }`
  - `DeclineSharedMemberCommand { targetClientId, memberEntryId }`
- **Events** — each command above is its own standalone transaction with its **own fresh `correlationId`**; `Suggest` and the later `Confirm`/`Decline` are linked only by the persisted `sharedFromClientId`/`memberEntryId`, never by `correlationId`, since arbitrary time passes between them.
  - `TrustedCircleMemberAdded { circleId, memberId, correlationId }`
  - `TrustedCircleMemberShareSuggested { targetCircleId, memberId, sharedFromClientId, correlationId }`
  - `TrustedCircleMemberConfirmed { circleId, memberId, correlationId }`
  - `TrustedCircleMemberDeclined { circleId, memberId, correlationId }`
  - `TrustedCircleMemberRemoved { circleId, memberId, correlationId }`
- **Jobs**: `MonthlyTrustStatsJob` (populates the separate `ProviderTrustStats` read-model: circles-joined / shares-received per month)
- **Queries**: `GetTrustedCircleByClientQuery`, `CountMutualTrustQuery`, `ListPendingSuggestionsQuery`
- **Sagas**: **`TrustedByCountSyncSaga`** — `TrustedCircleMemberConfirmed`/`Removed` → update `Provider`/`Organization.trustedByCount` (same `correlationId`, stops there).

### Infrastructure
- **Mappers**: `TrustedCircleMapper`, `TrustedCircleMemberMapper`
- **Repository impl**: `TrustedCircleRepository`

---

## 16. dispute

### Domain
- **`Dispute`** — `id`, `errandId`, `raisedById`, `raisedByType`, `reason`, `description`, `status: OPEN|UNDER_REVIEW|RESOLVED|REJECTED`, `resolution`, `resolvedById`, `resolvedAt`, `createdAt`, `updatedAt`
- **Repository**: `IDisputeRepository` — `save`, `findById`, `findByErrandId`, `findOpen()`
- **Errors**: `DisputeNotFoundError`, `DisputeAlreadyResolvedError`, `ErrandNotEligibleForDisputeError`

### Application
- **Commands**
  - `OpenDisputeCommand { errandId, raisedById, raisedByType, reason, description }`
  - `AssignReviewerCommand { disputeId, reviewerId }`
  - `ResolveDisputeCommand { disputeId, resolution, resolvedById }`
  - `RejectDisputeCommand { disputeId, resolvedById, reason }`
- **Events**
  - `DisputeOpened { disputeId, errandId, correlationId }`
  - `DisputeUnderReview { disputeId, reviewerId, correlationId }`
  - `DisputeResolved { disputeId, errandId, resolution, correlationId }`
  - `DisputeRejected { disputeId, correlationId }`
- **Queries**: `GetDisputeByIdQuery`, `ListOpenDisputesQuery`
- **Sagas**: **`DisputeResolutionProcessManager`** — `ResolveDisputeCommand` generates a fresh `correlationId` → `DisputeResolved` → `Escrow.release()` or `Escrow.refund()` (same id, cascading into `wallet`/`payment-gateway` as applicable).

### Infrastructure
- **Adapters**: `DocumentStorageAdapter`
- **Mappers**: `DisputeMapper`
- **Repository impl**: `DisputeRepository`

---

## 17. notification

### Domain
- **`NotificationLog`** — `id`, `userId`, `type`, `channel: EMAIL|SMS|PUSH`, `payload`, `status: SENT|FAILED`, `createdAt`
- **Repository**: `INotificationLogRepository` — `save`, `findById`, `findByUserId`
- **Errors**: `NotificationDeliveryError`

### Application
- **Commands**: `SendNotificationCommand { userId, type, channel, payload }`
- **Events**: `NotificationSent { notificationId, correlationId }`, `NotificationFailed { notificationId, reason, correlationId }`
- **Jobs**: `RetryFailedNotificationsJob`
- **Events consumed**: near-universal sink (representative subset) — `UserRegistered`, `ApplicationSubmitted`, `ApplicationAccepted`, `ApplicationRejected`, `ErrandAssigned`, `ErrandCompleted`, `PaymentFailed`, `WithdrawalCompleted`, `VerificationCompleted`, `DisputeOpened`, `DisputeResolved`, `MessageSent`, `TrustedCircleMemberShareSuggested`, `RatingSubmitted`
- **Queries**: `ListNotificationsByUserQuery`
- **Sagas**: none — `notification` never originates a `correlationId`; it always inherits the id of whatever event triggered the `SendNotificationCommand`, and is the terminal point for the vast majority of chains in the system.

### Infrastructure
- **Adapters**: `EmailAdapter`, `SmsAdapter`, `PushNotificationAdapter`
- **Mappers**: `NotificationLogMapper`
- **Repository impl**: `NotificationLogRepository`

---

## Remaining open item

- Cancel (`Application.cancel()`, `Errand.cancel()`) is intentionally left undesigned. Several items above depend on it: `NoShowDetectionJob`, `CancelErrandCommand`, `ErrandCancelled`, `EscrowRefundProcessManager`. Revisit when ready.
