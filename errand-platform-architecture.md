# Errand Platform — Module Architecture Reference

This document consolidates every module: domain layer (entities, value objects, domain services, repositories, events, errors), application layer (commands, jobs, event handlers, queries, sagas, process managers), and infrastructure layer (adapters, mappers, repository implementations).

Clusters, for orientation:
- **Identity & access**: users, client, provider, organizations, address, verification
- **Marketplace core**: service, errands, application
- **Money & escrow**: payment-gateway, escrow, wallet
- **Trust & social**: chat, rating, trusted-circle
- **Support**: dispute, notification

## Layer conventions used throughout this document

**Domain `Events`** are the event *definitions* a module's aggregates raise — the payload lives here, including `correlationId`.

**Application `Event Handlers`** are the listeners that *react* to events (this module's own, or another module's) by dispatching a command or mutating something. They reference the triggering event by name only — the payload is already defined once, under that event's owning module's Domain section.

**Domain Services** are stateless, cross-aggregate business logic that doesn't naturally belong to any single entity — not to be confused with the `service` *module* (which is the workers'-listed-offering aggregate). We have one so far: `VerificationGatePolicy`.

**Sagas vs. process managers** are two different folders, not one:
- **`sagas/`** — thin, single-hop, no-compensation relays: one triggering event in, one follow-up command out (matches Nest's actual `@Saga()` primitive).
- **`process-managers/`** — genuine multi-step orchestration across modules, with real failure branching and/or compensating actions on failure.

Decisions locked in:
1. Client requires only email + phone confirmation (via `User`) — no separate `VerificationProfile`.
2. Cancel (`Application.cancel()`, `Errand.cancel()`) remains deferred.
3. Sagas/process managers live in the module that raises the triggering event, not the module they call into — except process managers kicked off directly by a top-level command, which live wherever that command naturally belongs.

## Correlation ID convention

- A **fresh `correlationId`** is generated once, at the top-level command that starts a business transaction (e.g. `AcceptApplicationCommand`, `CompleteErrandCommand`, `RequestWithdrawalCommand`).
- It is threaded through **every event and every cascading command that fires synchronously/immediately as a direct consequence** of that top-level command, across however many modules the cascade touches.
- It **stops** once the cascade has no further direct consequences — i.e., once execution reaches a module that only records/notifies (typically `notification`) or a terminal state with nothing left to trigger.
- **Arbitrary-delay workflows do not share a `correlationId` across their steps.** If real time can pass between two steps because a *different actor* has to act (e.g. a share-suggestion waiting on the recipient to confirm, or a completed errand waiting on a rating), the second step is its own new transaction with its own fresh `correlationId`. Continuity across the delay is tracked with a **persistent reference id** stored on the record itself (e.g. `sharedFromClientId`), not with `correlationId`.
- **`causationId`** (optional) = the id of the specific event that directly caused this one, only where the causal parent isn't already obvious from context.

---

## 1. users

### Domain
- **Entities**: `User` — `id`, `email`, `phone`, `passwordHash`, `status: ACTIVE|SUSPENDED|DELETED`, `emailConfirmedAt: Date|null`, `phoneConfirmedAt: Date|null`, `createdAt`, `updatedAt`
- **Repository**: `IUserRepository` — `save`, `findById`, `findByEmail`, `findByPhone`
- **Events** *(each generates its own fresh `correlationId`; all terminate at Notification)*
  - `UserRegistered { userId, email, phone, correlationId }`
  - `UserSuspended { userId, reason, correlationId }`
  - `EmailConfirmed { userId, correlationId }`
  - `PhoneConfirmed { userId, correlationId }`
- **Errors**: `UserAlreadyExistsError`, `InvalidCredentialsError`, `UserSuspendedError`, `EmailAlreadyConfirmedError`

### Application
- **Commands**: `RegisterUserCommand { email, phone, password }`, `ChangePasswordCommand { userId, currentPassword, newPassword }`, `SuspendUserCommand { userId, reason }`, `ConfirmEmailCommand { userId, token }`, `ConfirmPhoneCommand { userId, otp }`
- **Jobs**: none required yet
- **Event Handlers**: none inbound — this module is upstream of everything else
- **Queries**: `GetUserByIdQuery`, `GetUserByEmailQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Adapters**: `PasswordHasherAdapter`, `EmailConfirmationTokenAdapter`
- **Mappers**: `UserMapper`
- **Repository impl**: `UserRepository`

---

## 2. client

### Domain
- **Entities**: `Client` — `id`, `userId`, `createdAt`, `updatedAt`
- **Repository**: `IClientRepository` — `save`, `findById`, `findByUserId`
- **Events**: `ClientProfileCreated { clientId, userId, correlationId }` — fresh id, stops at Notification.
- **Errors**: `ClientProfileAlreadyExistsError`, `ClientNotFoundError`

### Application
- **Commands**: `CreateClientProfileCommand { userId }`
- **Jobs**: none
- **Event Handlers**: none
- **Queries**: `GetClientByIdQuery`, `GetClientByUserIdQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Mappers**: `ClientMapper`
- **Repository impl**: `ClientRepository`

---

## 3. provider

### Domain
- **Entities**: `Provider` — `id`, `userId`, `organizationId: OrganizationId|null`, `workerType: CASUAL|ARTISAN|PROFESSIONAL`, `bio`, `skills: string[]`, `verificationStatus: boolean`, `trustedByCount: number`, `completedErrandsCount: number`, `disputedErrandsCount: number`, `avgResponseTimeSeconds: number|null`, `isActive`, `createdAt`, `updatedAt`
- **Value Objects**: `WorkerType`
- **Repository**: `IProviderRepository` — `save`, `findById`, `findByUserId`
- **Events**
  - `ProviderProfileCreated { providerId, userId, workerType, correlationId }`
  - `ProviderJoinedOrganization { providerId, organizationId, correlationId }`
  - `ProviderLeftOrganization { providerId, correlationId }`
- **Errors**: `ProviderProfileAlreadyExistsError`, `ProviderNotFoundError`, `ProviderNotVerifiedError`

### Application
- **Commands**: `CreateProviderProfileCommand { userId, workerType, bio, skills }`, `UpdateProviderProfileCommand { providerId, bio?, skills? }`, `DeactivateProviderCommand { providerId }`, `JoinOrganizationCommand { providerId, organizationId }`, `LeaveOrganizationCommand { providerId }`
- **Jobs**: `ProviderResponseTimeRecalcJob` (nightly; recomputes `avgResponseTimeSeconds` from `chat`'s `firstResponseAt` data)
- **Event Handlers**
  - `VerificationCompleted` (from `verification`) → set `verificationStatus = true`
  - `TrustedCircleMemberConfirmed` / `TrustedCircleMemberRemoved` (from `trusted-circle`) → adjust `trustedByCount`
  - `ErrandCompleted` (from `errands`) → increment `completedErrandsCount`
  - `DisputeOpened` (from `dispute`) → increment `disputedErrandsCount`
- **Queries**: `GetProviderByIdQuery`, `GetProviderPublicProfileQuery`, `SearchProvidersByServiceQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Mappers**: `ProviderMapper`
- **Repository impl**: `ProviderRepository`

---

## 4. organizations

### Domain
- **Entities**: `Organization` — `id`, `ownerUserId`, `name`, `businessRegistrationNumber`, `verificationStatus: boolean`, `createdAt`, `updatedAt`
- **Repository**: `IOrganizationRepository` — `save`, `findById`, `findByOwnerUserId`, `findMembers(orgId)`
- **Events**
  - `OrganizationCreated { organizationId, ownerUserId, correlationId }`
  - `OrganizationMemberAdded { organizationId, providerId, correlationId }`
  - `OrganizationMemberRemoved { organizationId, providerId, correlationId }`
- **Errors**: `OrganizationNotFoundError`, `MemberAlreadyInOrganizationError`, `MemberNotInOrganizationError`

### Application
- **Commands**: `CreateOrganizationCommand { ownerUserId, name, businessRegistrationNumber }`, `AddOrganizationMemberCommand { organizationId, providerId }`, `RemoveOrganizationMemberCommand { organizationId, providerId }`, `AssignMemberToErrandCommand { organizationId, errandId, providerId }`
- **Jobs**: none
- **Event Handlers**: `VerificationCompleted` (from `verification`) → set org-level `verificationStatus`
- **Queries**: `GetOrganizationByIdQuery`, `ListOrganizationMembersQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Mappers**: `OrganizationMapper`
- **Repository impl**: `OrganizationRepository`

---

## 5. address

### Domain
- **Entities**: `Address` — `id`, `ownerUserId`, `label`, `street`, `city`, `state`, `country`, `latitude`, `longitude`, `isDefault`, `createdAt`, `updatedAt`
- **Value Objects**: `Coordinates { latitude, longitude }`
- **Repository**: `IAddressRepository` — `save`, `findById`, `findByUserId`
- **Events**
  - `AddressCreated { addressId, ownerUserId, correlationId }`
  - `AddressUpdated { addressId, correlationId }`
  - `DefaultAddressChanged { ownerUserId, addressId, correlationId }`
- **Errors**: `AddressNotFoundError`

### Application
- **Commands**: `CreateAddressCommand { ownerUserId, label, street, city, state, country }`, `UpdateAddressCommand { addressId, label?, street?, city?, state?, country? }`, `SetDefaultAddressCommand { addressId }`, `DeleteAddressCommand { addressId }`
- **Jobs**: none
- **Event Handlers**: none
- **Queries**: `GetAddressByIdQuery`, `ListAddressesByUserQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Adapters**: `GeocodingAdapter`
- **Mappers**: `AddressMapper`
- **Repository impl**: `AddressRepository`

---

## 6. verification

### Domain
- **Entities**: `VerificationProfile` (aggregate root) — `id`, `subjectType: PROVIDER|ORGANIZATION`, `subjectId`, `workerType: WorkerType|null`, `requiredSteps: StepType[]`, `overallStatus: INCOMPLETE|COMPLETE`, `createdAt`, `updatedAt`; `VerificationStep` (entity within) — `id`, `stepType: NIN_VERIFIED|LICENSE_VERIFIED|BUSINESS_REG_VERIFIED`, `status: PENDING|SUBMITTED|APPROVED|REJECTED`, `documentUrls: string[]`, `submittedAt`, `reviewedAt`, `reviewerId`, `rejectionReason`
- **Domain Services**: **`VerificationGatePolicy`** — `isFullyVerified(subjectType, subjectId): boolean`. Checks `User.emailConfirmedAt && User.phoneConfirmedAt` always, plus `VerificationProfile.overallStatus === COMPLETE` only when that subject's tier requires extra steps. Called *synchronously* by `application` and `service` command handlers before allowing submission/listing — not an event reaction.
- **Repository**: `IVerificationProfileRepository` — `save`, `findById`, `findBySubject(subjectType, subjectId)`, `findPendingSteps()`
- **Events**
  - `VerificationStepSubmitted { verificationProfileId, stepType, correlationId }`
  - `VerificationStepApproved { verificationProfileId, stepType, reviewerId, correlationId }`
  - `VerificationStepRejected { verificationProfileId, stepType, reviewerId, reason, correlationId }`
  - `VerificationCompleted { subjectType, subjectId, correlationId }` — same id as whichever `approveStep()` completed the last requirement; carries into Provider/Organization's cached-field update, then stops.
- **Errors**: `VerificationProfileNotFoundError`, `StepAlreadyApprovedError`, `MissingRequiredDocumentsError`

Note: email/phone confirmation are not steps here — they live on `User`. A Client or Casual provider may have no `VerificationProfile` at all.

### Application
- **Commands**: `SubmitVerificationStepCommand { subjectType, subjectId, stepType, documentUrls }`, `ApproveVerificationStepCommand { verificationProfileId, stepType, reviewerId }`, `RejectVerificationStepCommand { verificationProfileId, stepType, reviewerId, reason }`
- **Jobs**: `AutoKYCCheckJob`
- **Event Handlers**: none inbound — this module gates everything else, nothing gates it
- **Queries**: `GetVerificationProfileBySubjectQuery`, `ListPendingVerificationStepsQuery`
- **Sagas**: `AutoKYCReviewSaga` — `VerificationStepSubmitted` (fresh `correlationId`) → external API call → `approveStep()`/`rejectStep()`, same id.
- **Process Managers**: none

### Infrastructure
- **Adapters**: `NINVerificationApiAdapter`, `LicenseVerificationApiAdapter`, `DocumentStorageAdapter`
- **Mappers**: `VerificationProfileMapper`
- **Repository impl**: `VerificationProfileRepository`

---

## 7. service

### Domain
- **Entities**: `Service` — `id`, `listedById`, `listedByType: PROVIDER|ORGANIZATION`, `title`, `description`, `category`, `priceKobo`, `currency`, `isActive`, `createdAt`, `updatedAt`
- **Repository**: `IServiceRepository` — `save`, `findById`, `findByListerId`, `findActiveByCategory`
- **Events**
  - `ServiceListed { serviceId, listedById, correlationId }`
  - `ServiceDeactivated { serviceId, correlationId }`
- **Errors**: `ServiceNotFoundError`, `ServiceNotOwnedByListerError`

### Application
- **Commands**: `ListServiceCommand { listedById, listedByType, title, description, category, priceKobo, currency }`, `UpdateServicePriceCommand { serviceId, priceKobo }`, `DeactivateServiceCommand { serviceId }`
- **Jobs**: none
- **Event Handlers**: none — the verification gate is a synchronous call to `VerificationGatePolicy` inside `ListServiceCommand`'s handler, not an event reaction
- **Queries**: `SearchServicesQuery`, `GetServiceByIdQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Mappers**: `ServiceMapper`
- **Repository impl**: `ServiceRepository`

---

## 8. errands

### Domain
- **Entities**: `Errand` — `id`, `clientId`, `serviceId: ServiceId|null`, `title`, `description`, `addressId`, `budgetKobo`, `currency`, `status: DRAFT|PUBLISHED|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED`, `sourceType: OPEN_BID|TRUSTED_DIRECT_ASSIGN|SERVICE_BOOKING`, `acceptedApplicationId: ApplicationId|null`, `startedAt`, `completedAt`, `cancelledAt`, `relistedFromErrandId: ErrandId|null`, `createdAt`, `updatedAt`
- **Repository**: `IErrandRepository` — `save`, `findById`, `findByClientId`, `findOpenErrands`, `findAssignedPastStart`
- **Events**
  - `ErrandCreated { errandId, clientId, sourceType, correlationId }`
  - `ErrandPublished { errandId, correlationId }`
  - `ErrandAssigned { errandId, acceptedApplicationId, correlationId }`
  - `ErrandStarted { errandId, correlationId }`
  - `ErrandCompleted { errandId, correlationId }`
  - `ErrandCancelled { errandId, reason, correlationId }` *(deferred)*
- **Errors**: `ErrandNotFoundError`, `ErrandInvariantError`, `ErrandNotOpenError`

### Application
- **Commands**: `CreateErrandCommand { clientId, title, description, addressId, budgetKobo, currency }`, `PublishErrandCommand { errandId }`, `AssignErrandToTrustedMemberCommand { clientId, title, description, addressId, budgetKobo, currency, trustedMemberId, trustedMemberType }`, `BookServiceCommand { clientId, serviceId, addressId }`, `StartErrandCommand { errandId, providerId }`, `CompleteErrandCommand { errandId }`
- **Jobs**: `StaleDraftCleanupJob`, `NoShowDetectionJob` *(deferred)*
- **Event Handlers**: `PaymentSucceeded` (from `payment-gateway`) — consumed inside the process managers below, to call `assignTo()`
- **Queries**: `BrowseOpenErrandsQuery`, `GetErrandByIdQuery`, `ListClientErrandsQuery`
- **Sagas** *(thin, single-hop)*
  - `ChatLifecycleSaga` — `ErrandAssigned` → dispatches `OpenChatThreadCommand` into `chat`; `ErrandCompleted`/`ErrandCancelled` → dispatches `CloseChatThreadCommand` into `chat`. Same `correlationId`.
  - `RatingPromptSaga` — `ErrandCompleted` → dispatches `SendNotificationCommand` into `notification` for both parties. Same `correlationId`.
- **Process Managers** *(multi-step)*
  - `EscrowReleaseProcessManager` — `ErrandCompleted` → `Escrow.release()` → `Wallet.credit()`. Same `correlationId` throughout.
  - `EscrowRefundProcessManager` *(deferred)* — `ErrandCancelled` → `Escrow.refund()` → `PaymentTransaction.refund()`. Same `correlationId`.
  - `DirectBookingProcessManager` — `BookServiceCommand` (fresh `correlationId`) → `PaymentTransaction.initiate()` → on `PaymentSucceeded` → `Errand.create()` already `ASSIGNED` → `Escrow.create()`. On `PaymentFailed`, nothing is mutated and the client can retry immediately.

  *(`AcceptApplicationProcessManager` also assigns errands, but its home is `application`, since that's where `AcceptApplicationCommand` lives — see below.)*

### Infrastructure
- **Mappers**: `ErrandMapper`
- **Repository impl**: `ErrandRepository`

---

## 9. application

### Domain
- **Entities**: `Application` — `id`, `errandId`, `applicantType: PROVIDER|ORGANIZATION`, `applicantId`, `status: PENDING|ACCEPTED|REJECTED`, `proposal`, `proposedAmountKobo`, `currency`, `acceptedAt`, `rejectedAt`, `createdAt`, `updatedAt`
- **Repository**: `IApplicationRepository` — `save`, `findById`, `findByErrandId`, `findPendingByErrandId`, `findByApplicantId`, `existsByErrandAndApplicant`
- **Events**
  - `ApplicationSubmitted { applicationId, errandId, applicantId, correlationId }`
  - `ApplicationAccepted { applicationId, errandId, applicantId, correlationId }`
  - `ApplicationRejected { applicationId, errandId, correlationId }`
- **Errors**: `ApplicationInvariantError`, `ApplicationNotFoundError`, `DuplicateApplicationError`

### Application (layer)
- **Commands**: `SubmitApplicationCommand { errandId, applicantType, applicantId, proposal, proposedAmountKobo, currency }`, `AcceptApplicationCommand { applicationId, clientId }`, `RejectApplicationCommand { applicationId, clientId }`, `RejectOtherApplicationsCommand { errandId, acceptedApplicationId, correlationId }` (internal, saga-issued only)
- **Jobs**: none
- **Event Handlers**: `PaymentSucceeded` (from `payment-gateway`) — consumed inside `AcceptApplicationProcessManager`, to call `accept()`
- **Queries**: `GetApplicationByIdQuery`, `ListApplicationsByErrandQuery` (client viewing applicants on their errand), `ListApplicationsByApplicantQuery` (provider/org viewing their own submitted applications)
- **Sagas** *(thin)*: `RejectOtherApplicationsSaga` — reads `correlationId` off `ApplicationAccepted`, dispatches `RejectOtherApplicationsCommand` for every sibling pending application, same id.
- **Process Managers**: `AcceptApplicationProcessManager` — `AcceptApplicationCommand` generates a fresh `correlationId` → `PaymentTransaction.initiate()` → on `PaymentSucceeded` (same id) → `Application.accept()` → `Errand.assignTo()` → `Escrow.create()` → `ChatThread.open()` (all same id). On `PaymentFailed`, the chain stops immediately — nothing else is touched, and the client can retry right away with a **brand-new** `correlationId`.

### Infrastructure
- **Mappers**: `ApplicationMapper`
- **Repository impl**: `ApplicationRepository`

---

## 10. payment-gateway

### Domain
- **Entities**: `PaymentTransaction` — `id`, `clientId`, `purposeType: APPLICATION_ACCEPT|SERVICE_BOOKING`, `purposeId`, `amountKobo`, `currency`, `status: PENDING|SUCCEEDED|FAILED|REFUNDED`, `gatewayReference`, `method`, `failureReason`, `createdAt`, `updatedAt`
- **Repository**: `IPaymentTransactionRepository` — `save`, `findById`, `findByGatewayReference`, `findByPurposeId`
- **Events**
  - `PaymentSucceeded { paymentTransactionId, purposeType, purposeId, amountKobo, correlationId }`
  - `PaymentFailed { paymentTransactionId, purposeId, reason, correlationId }` — chain stops here.
  - `PaymentRefunded { paymentTransactionId, correlationId }`
- **Errors**: `PaymentTransactionNotFoundError`, `GatewayTimeoutError`, `InvalidPaymentMethodError`

### Application
- **Commands**: `InitiateChargeCommand { clientId, purposeType, purposeId, amountKobo, currency, paymentMethodId, correlationId }` (always receives the caller's `correlationId`), `RefundPaymentCommand { paymentTransactionId, correlationId }`
- **Jobs**: `GatewayReconciliationJob`
- **Event Handlers**: `EscrowRefunded` (from `escrow`) → dispatch `RefundPaymentCommand`, same `correlationId`
- **Queries**: `GetPaymentTransactionByIdQuery`, `FindByGatewayReferenceQuery`
- **Sagas**: none
- **Process Managers**: none — this module is triggered by, not orchestrating, the higher-level flows

### Infrastructure
- **Adapters**: `PaymentGatewayAdapter`, `WebhookVerifierAdapter`
- **Mappers**: `PaymentTransactionMapper`
- **Repository impl**: `PaymentTransactionRepository`

---

## 11. escrow

### Domain
- **Entities**: `Escrow` — `id`, `errandId`, `paymentTransactionId`, `amountKobo`, `currency`, `status: HELD|RELEASED|REFUNDED`, `heldAt`, `releasedAt`, `refundedAt`, `releasedToWalletId`, `createdAt`, `updatedAt`
- **Repository**: `IEscrowRepository` — `save`, `findById`, `findByErrandId`
- **Events**
  - `EscrowCreated { escrowId, errandId, amountKobo, correlationId }`
  - `EscrowReleased { escrowId, errandId, walletId, amountKobo, correlationId }`
  - `EscrowRefunded { escrowId, errandId, correlationId }`
- **Errors**: `EscrowNotFoundError`, `EscrowAlreadyFinalizedError`

### Application
- **Commands**: `CreateEscrowCommand { errandId, paymentTransactionId, amountKobo, currency, correlationId }`, `ReleaseEscrowCommand { escrowId, correlationId }`, `RefundEscrowCommand { escrowId, correlationId }`
- **Jobs**: `EscrowAutoReleaseJob`
- **Event Handlers**: `PaymentSucceeded` (from `payment-gateway`) → create; `DisputeOpened` (from `dispute`) → suppress auto-release; `DisputeResolved` (from `dispute`) → release or refund per resolution, `correlationId` inherited
- **Queries**: `GetEscrowByErrandIdQuery`
- **Sagas**: none owned here — reacted to by `errands`' process managers and `dispute`'s saga, per the trigger-module convention
- **Process Managers**: none owned here

### Infrastructure
- **Mappers**: `EscrowMapper`
- **Repository impl**: `EscrowRepository`

---

## 12. wallet

### Domain
- **Entities**: `Wallet` — `id`, `ownerId`, `ownerType: PROVIDER|ORGANIZATION`, `balanceKobo`, `currency`, `createdAt`, `updatedAt`; `WalletTransaction` (ledger) — `id`, `walletId`, `type: CREDIT|DEBIT`, `amountKobo`, `referenceType`, `referenceId`, `createdAt`; `Withdrawal` — `id`, `walletId`, `amountKobo`, `currency`, `status: PENDING|COMPLETED|FAILED`, `destinationBankAccountId`, `gatewayReference`, `createdAt`, `updatedAt`
- **Repositories**: `IWalletRepository`, `IWalletTransactionRepository`, `IWithdrawalRepository`
- **Events**
  - `WalletCredited { walletId, amountKobo, referenceId, correlationId }`
  - `WalletDebited { walletId, amountKobo, referenceId, correlationId }`
  - `WithdrawalRequested { withdrawalId, walletId, amountKobo, correlationId }`
  - `WithdrawalCompleted { withdrawalId, correlationId }`
  - `WithdrawalFailed { withdrawalId, reason, correlationId }`
- **Errors**: `InsufficientBalanceError`, `WalletNotFoundError`, `WithdrawalNotFoundError`

### Application
- **Commands**: `RequestWithdrawalCommand { walletId, amountKobo, destinationBankAccountId }` — generates a fresh `correlationId`
- **Jobs**: `StuckWithdrawalSweepJob`
- **Event Handlers**: `EscrowReleased` (from `escrow`) → `Wallet.credit()`
- **Queries**: `GetWalletBalanceQuery`, `ListWalletTransactionsQuery`
- **Sagas**: none
- **Process Managers**: `WithdrawalProcessManager` — debits the wallet immediately on request (preventing double-withdrawal) → calls the payout adapter → `WithdrawalCompleted`, or `WithdrawalFailed` + a compensating `WalletCredited` (same `correlationId`)

### Infrastructure
- **Adapters**: `BankTransferAdapter`
- **Mappers**: `WalletMapper`, `WalletTransactionMapper`, `WithdrawalMapper`
- **Repository impls**: `WalletRepository`, `WalletTransactionRepository`, `WithdrawalRepository`

---

## 13. chat

### Domain
- **Entities**: `ChatThread` (aggregate root) — `id`, `errandId`, `participantIds: string[]`, `createdAt`, `closedAt`, `firstResponseAt: Date|null`; `ChatMessage` (entity within) — `id`, `threadId`, `senderId`, `content`, `sentAt`
- **Repository**: `IChatThreadRepository` — `save`, `findById`, `findByErrandId`
- **Events**
  - `ChatThreadOpened { threadId, errandId, correlationId }`
  - `MessageSent { threadId, senderId, correlationId }`
  - `ChatThreadClosed { threadId, correlationId }`
  - `ProviderRespondedFirstTime { threadId, providerId, responseTimeSeconds, correlationId }`
- **Errors**: `ChatThreadNotFoundError`, `ChatThreadClosedError`

### Application
- **Commands**: `OpenChatThreadCommand { errandId, participantIds, correlationId }` (dispatched into this module by `errands`' `ChatLifecycleSaga`), `CloseChatThreadCommand { threadId, correlationId }` (same), `SendMessageCommand { threadId, senderId, content }` (standalone user action — own fresh `correlationId` each time)
- **Jobs**: none
- **Event Handlers**: none owned here — the reactions to `ErrandAssigned`/`ErrandCompleted`/`ErrandCancelled` live in `errands`' `ChatLifecycleSaga`, which calls the two commands above
- **Queries**: `GetChatThreadByErrandIdQuery`, `ListMessagesQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Adapters**: `RealtimeMessagingAdapter`
- **Mappers**: `ChatThreadMapper`, `ChatMessageMapper`
- **Repository impl**: `ChatThreadRepository`

---

## 14. rating

### Domain
- **Entities**: `Rating` — `id`, `errandId`, `raterId`, `raterType`, `rateeId`, `rateeType`, `score: 1-5`, `comment`, `createdAt`
- **Value Objects**: `Score`
- **Repository**: `IRatingRepository` — `save`, `findById`, `findByRateeId`
- **Events**: `RatingSubmitted { ratingId, errandId, rateeId, score, correlationId }`
- **Errors**: `RatingAlreadySubmittedError`, `RatingNotAllowedError`

### Application
- **Commands**: `SubmitRatingCommand { errandId, raterId, raterType, rateeId, rateeType, score, comment }` — standalone later action, own fresh `correlationId`, never the `CompleteErrandCommand`'s id
- **Jobs**: none
- **Event Handlers**: none owned here — the *prompt* to rate is `errands`' `RatingPromptSaga`, which just sends a notification and doesn't touch this module until the user actually submits
- **Queries**: `GetAverageRatingByRateeQuery`, `ListRatingsForRateeQuery`
- **Sagas**: none
- **Process Managers**: none

### Infrastructure
- **Mappers**: `RatingMapper`
- **Repository impl**: `RatingRepository`

---

## 15. trusted-circle

### Domain
- **Entities**: `TrustedCircle` (aggregate root, exactly one per client) — `id`, `ownerClientId` (unique), `createdAt`, `updatedAt`; `TrustedCircleMember` (entity within) — `id`, `memberId`, `memberType: PROVIDER|ORGANIZATION`, `status: CONFIRMED|SUGGESTED`, `sharedFromClientId: ClientId|null`, `addedAt`
- **Repository**: `ITrustedCircleRepository` — `save`, `findByOwnerClientId`, `existsByOwnerAndMember`, `countMutualTrust(viewingClientId, providerId)`
- **Events**
  - `TrustedCircleMemberAdded { circleId, memberId, correlationId }`
  - `TrustedCircleMemberShareSuggested { targetCircleId, memberId, sharedFromClientId, correlationId }`
  - `TrustedCircleMemberConfirmed { circleId, memberId, correlationId }`
  - `TrustedCircleMemberDeclined { circleId, memberId, correlationId }`
  - `TrustedCircleMemberRemoved { circleId, memberId, correlationId }`
- **Errors**: `TrustedCircleNotFoundError`, `MemberAlreadyInCircleError`, `SuggestionNotFoundError`

### Application
- **Commands**: `AddTrustedMemberCommand { ownerClientId, memberId, memberType }`, `RemoveTrustedMemberCommand { ownerClientId, memberId }`, `ShareTrustedMemberCommand { sharerClientId, memberId, targetClientId }` (verifies the member is `CONFIRMED` in the sharer's own circle, then only ever mutates the target's circle via `receiveSuggestion()`), `ConfirmSharedMemberCommand { targetClientId, memberEntryId }`, `DeclineSharedMemberCommand { targetClientId, memberEntryId }`
- **Jobs**: `MonthlyTrustStatsJob` (populates the separate `ProviderTrustStats` read-model)
- **Event Handlers**: none inbound
- **Queries**: `GetTrustedCircleByClientQuery`, `CountMutualTrustQuery` (second-degree trust), `ListPendingSuggestionsQuery`
- **Sagas** *(thin)*: `TrustedByCountSyncSaga` — `TrustedCircleMemberConfirmed`/`Removed` → update `Provider`/`Organization.trustedByCount`, same `correlationId`
- **Process Managers**: none

### Infrastructure
- **Mappers**: `TrustedCircleMapper`, `TrustedCircleMemberMapper`
- **Repository impl**: `TrustedCircleRepository`

---

## 16. dispute

### Domain
- **Entities**: `Dispute` — `id`, `errandId`, `raisedById`, `raisedByType`, `reason`, `description`, `status: OPEN|UNDER_REVIEW|RESOLVED|REJECTED`, `resolution`, `resolvedById`, `resolvedAt`, `createdAt`, `updatedAt`
- **Repository**: `IDisputeRepository` — `save`, `findById`, `findByErrandId`, `findOpen()`
- **Events**
  - `DisputeOpened { disputeId, errandId, correlationId }`
  - `DisputeUnderReview { disputeId, reviewerId, correlationId }`
  - `DisputeResolved { disputeId, errandId, resolution, correlationId }`
  - `DisputeRejected { disputeId, correlationId }`
- **Errors**: `DisputeNotFoundError`, `DisputeAlreadyResolvedError`, `ErrandNotEligibleForDisputeError`

### Application
- **Commands**: `OpenDisputeCommand { errandId, raisedById, raisedByType, reason, description }`, `AssignReviewerCommand { disputeId, reviewerId }`, `ResolveDisputeCommand { disputeId, resolution, resolvedById }`, `RejectDisputeCommand { disputeId, resolvedById, reason }`
- **Jobs**: none required yet
- **Event Handlers**: none inbound
- **Queries**: `GetDisputeByIdQuery`, `ListOpenDisputesQuery`
- **Sagas** *(thin — single branch, no compensation)*: `DisputeResolutionSaga` — `ResolveDisputeCommand` generates a fresh `correlationId` → `DisputeResolved` → dispatches `Escrow.release()` or `Escrow.refund()` depending on the resolution, same id
- **Process Managers**: none

### Infrastructure
- **Adapters**: `DocumentStorageAdapter`
- **Mappers**: `DisputeMapper`
- **Repository impl**: `DisputeRepository`

---

## 17. notification

### Domain
- **Entities**: `NotificationLog` — `id`, `userId`, `type`, `channel: EMAIL|SMS|PUSH`, `payload`, `status: SENT|FAILED`, `createdAt`
- **Repository**: `INotificationLogRepository` — `save`, `findById`, `findByUserId`
- **Events**: `NotificationSent { notificationId, correlationId }`, `NotificationFailed { notificationId, reason, correlationId }`
- **Errors**: `NotificationDeliveryError`

### Application
- **Commands**: `SendNotificationCommand { userId, type, channel, payload }`
- **Jobs**: `RetryFailedNotificationsJob`
- **Event Handlers**: near-universal sink (representative subset) — `UserRegistered`, `ApplicationSubmitted`, `ApplicationAccepted`, `ApplicationRejected`, `ErrandAssigned`, `ErrandCompleted`, `PaymentFailed`, `WithdrawalCompleted`, `VerificationCompleted`, `DisputeOpened`, `DisputeResolved`, `MessageSent`, `TrustedCircleMemberShareSuggested`, `RatingSubmitted`
- **Queries**: `ListNotificationsByUserQuery`
- **Sagas**: none
- **Process Managers**: none — pure consumer, never an orchestrator; never originates a `correlationId`, always inherits the one from whatever triggered it

### Infrastructure
- **Adapters**: `EmailAdapter`, `SmsAdapter`, `PushNotificationAdapter`
- **Mappers**: `NotificationLogMapper`
- **Repository impl**: `NotificationLogRepository`

---

## Domain services summary

| Domain Service | Lives in | Used by | Purpose |
|---|---|---|---|
| `VerificationGatePolicy` | `verification` | `application`, `service` (synchronous call inside command handlers) | `isFullyVerified(subjectType, subjectId)` — combines `User`-level confirmation with tier-specific `VerificationProfile` completeness |

A likely future addition once cancel is designed: an `ApplicationCancellationPolicy` in `application` that checks `Errand.hasStarted()` before allowing `Application.cancel()`.

If you spot other cross-aggregate rules that don't fit neatly into a single entity as we keep building, flag them — this table is meant to grow.

## Remaining open item

- Cancel (`Application.cancel()`, `Errand.cancel()`) is intentionally left undesigned. Several items above depend on it: `NoShowDetectionJob`, `CancelErrandCommand`, `ErrandCancelled`, `EscrowRefundProcessManager`. Revisit when ready.
