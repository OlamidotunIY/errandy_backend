# Errandy Backend - DDD & EIP Overview

## Executive Summary

Errandy Backend is a NestJS GraphQL monolith organized as bounded domain modules. Each module follows the same four-layer structure: a persistence-ignorant domain model, CQRS application use cases, Prisma-backed infrastructure, and GraphQL presentation adapters.

The architecture uses Enterprise Integration Patterns where they fit the business problem: append-only wallet ledgers, materialized read models, idempotent payment receivers, sagas/process managers for cross-module workflows, reconciliation jobs, and dead-letter channels for replayable failures.

## Module Classification

### Core Domain

Escrow, Wallet, Errands, Application, Users, Provider, Client, Rating, Chat, Dispute, Address, Auth, Service, Organization, Trusted Circle, Notification, Verification, Payment Gateway.

### Infrastructure Dependencies

Redis and BullMQ provide queue execution. PubSub supports subscriptions. Firebase, Push, Email, Config, Common, and shared utilities are infrastructure or shared-kernel dependencies and are documented separately when needed by domain modules.

## Cross-Module Dependency Map

Domain modules reference other modules by typed IDs and domain events. Presentation layers dispatch commands and queries through `CommandBus` and `QueryBus`. Sagas and event handlers react through `EventBus` and never inject command/query handler classes directly.

## Cross-Module Interface Summary

### Repository Interfaces

| Module | Interface | Implementation | Responsibility |
| --- | --- | --- | --- |
| Users | `IUserRepository` | `PrismaUserRepository` | `User` aggregate persistence |
| Provider | `IProviderRepository` | `PrismaProviderRepository` | `Provider` aggregate persistence |
| Client | `IClientRepository` | `PrismaClientRepository` | `Client` aggregate persistence |
| Errands | `IErrandRepository` | `PrismaErrandRepository` | `Errand` aggregate persistence |
| Application | `IApplicationRepository` | `PrismaApplicationRepository` | `Application` aggregate persistence |
| Escrow | `IEscrowRepository` | `PrismaEscrowRepository` | `Escrow` aggregate persistence |
| Wallet | `IWalletRepository` | `PrismaWalletRepository` | `Wallet` aggregate persistence |
| Wallet | `ILedgerEntryRepository` | Prisma implementation | Supporting wallet read/write model |
| Wallet | `IWalletBalanceSnapshotRepository` | Prisma implementation | Supporting wallet read/write model |
| Rating | `IRatingRepository` | `PrismaRatingRepository` | `Rating` aggregate persistence |
| Chat | `IChatRoomRepository` | `PrismaChatRoomRepository` | `ChatRoom` aggregate persistence |
| Dispute | `IDisputeRepository` | `PrismaDisputeRepository` | `Dispute` aggregate persistence |
| Address | `IUserAddressRepository` | `PrismaUserAddressRepository` | `UserAddress` aggregate persistence |
| Auth | `IAuthRepository` | `PrismaAuthIdentityRepository` | `AuthIdentity` aggregate persistence |
| Service | `IServiceRepository` | `PrismaServiceCategoryAggregateRepository` | `ServiceCategoryAggregate` aggregate persistence |
| Organization | `IOrganizationRepository` | `PrismaOrganizationRepository` | `Organization` aggregate persistence |
| Trusted Circle | `ITrustedCircleRepository` | `PrismaTrustedCircleRepository` | `TrustedCircle` aggregate persistence |
| Notification | `INotificationHistoryRepository` | `PrismaNotificationRequestRepository` | `NotificationRequest` aggregate persistence |
| Verification | `IVerificationRepository` | `PrismaVerificationRepository` | `Verification` aggregate persistence |
| Payment Gateway | `IPaymentMethodRepository` | `PrismaPaymentMethodRepository` | `PaymentMethod` aggregate persistence |

### Commands And Queries

| Module | Type | Interfaces |
| --- | --- | --- |
| Users | Commands | `UpdateUserProfileCommand`, `SetActiveAddressCommand`, `ClearActiveAddressCommand` |
| Users | Queries | `GetUserProfileQuery`, `FindUserByEmailQuery` |
| Provider | Commands | `CreateProviderCommand`, `UpdateProviderProfileCommand`, `VerifyProviderCommand`, `UpdateProviderRatingSnapshotCommand` |
| Provider | Queries | `GetProviderQuery`, `DiscoverProvidersQuery`, `SearchProvidersQuery` |
| Client | Commands | `CreateClientCommand`, `VerifyClientCommand`, `UpdateClientRatingSnapshotCommand` |
| Client | Queries | `GetClientQuery`, `GetClientDashboardQuery` |
| Errands | Commands | `CreateErrandCommand`, `PublishErrandCommand`, `AssignWorkerCommand`, `CompleteErrandCommand`, `CancelErrandCommand` |
| Errands | Queries | `GetErrandByIdQuery`, `GetPersonalizedFeedQuery`, `GetMyErrandsQuery` |
| Application | Commands | `SubmitApplicationCommand`, `AcceptApplicationCommand`, `RejectApplicationCommand`, `CancelApplicationCommand`, `CancelOtherApplicationsCommand` |
| Application | Queries | `GetApplicationQuery`, `ListErrandApplicationsQuery`, `GetMyApplicationQuery`, `GetApplicationSummaryQuery` |
| Escrow | Commands | `FundEscrowCommand`, `MarkEscrowCompletedCommand`, `ReleaseEscrowCommand`, `RefundEscrowCommand` |
| Escrow | Queries | `GetEscrowByErrandQuery` |
| Wallet | Commands | `CreditActiveErrandCommand`, `MoveActiveToPendingCommand`, `ReleaseToAvailableCommand`, `RecordWithdrawalCommand`, `ReverseActiveErrandCommand`, `RecordClientRefundCommand`, `AppendFailedLedgerEntryCommand` |
| Wallet | Queries | `GetWalletBalancesQuery`, `GetLedgerHistoryQuery` |
| Rating | Commands | `CreateRatingCommand`, `AddRatingReactionCommand`, `RemoveRatingReactionCommand`, `AddRatingReplyCommand`, `UpdateRatingReplyCommand` |
| Rating | Queries | `GetRatingQuery`, `GetUserRatingsQuery`, `GetRatingStatsQuery` |
| Chat | Commands | `CreateChatRoomCommand`, `SendMessageCommand`, `MarkMessageAsReadCommand`, `AddParticipantCommand`, `RemoveParticipantCommand` |
| Chat | Queries | `GetChatRoomQuery`, `ListUserChatRoomsQuery`, `GetMessagesQuery` |
| Dispute | Commands | `OpenDisputeCommand`, `ResolveDisputeCommand` |
| Dispute | Queries | `GetDisputeQuery`, `ListErrandDisputesQuery` |
| Address | Commands | `SaveUserAddressCommand`, `DeleteUserAddressCommand` |
| Address | Queries | `SuggestAddressesQuery`, `ReverseGeocodeQuery`, `GetUserAddressesQuery` |
| Auth | Commands | `HandleSignUpCompleteCommand`, `HandleLoginSucceededCommand`, `RevokeSessionCommand` |
| Auth | Queries | `GetCurrentSessionQuery` |
| Service | Commands | `RefreshServiceCatalogCommand` |
| Service | Queries | `GetServiceCategoriesQuery`, `GetServicesByCategoryQuery` |
| Organization | Commands | `CreateOrganizationCommand`, `AddOrganizationMemberCommand`, `RemoveOrganizationMemberCommand` |
| Organization | Queries | `GetMyOrganizationQuery`, `ListOrganizationMembersQuery` |
| Trusted Circle | Commands | `AddToTrustedCircleCommand`, `RemoveFromTrustedCircleCommand`, `ShareTrustedCircleCommand` |
| Trusted Circle | Queries | `GetTrustedCircleQuery` |
| Notification | Commands | `SendNotificationCommand` |
| Notification | Queries | `GetNotificationHistoryQuery` |
| Verification | Commands | `SendVerificationCodeCommand`, `VerifyCodeCommand`, `ExpireVerificationCommand` |
| Verification | Queries | `GetVerificationQuery` |
| Payment Gateway | Commands | `AddPaymentMethodCommand`, `RemovePaymentMethodCommand`, `InitializePaymentCommand`, `RecordWebhookEventCommand` |
| Payment Gateway | Queries | `GetPaymentMethodsQuery` |

### Domain Events

| Module | Events |
| --- | --- |
| Users | `UserProfileUpdatedEvent`, `ActiveAddressChangedEvent`, `ActiveAddressClearedEvent` |
| Provider | `ProviderCreatedEvent`, `ProviderProfileUpdatedEvent`, `ProviderVerifiedEvent`, `ProviderRatingSnapshotUpdatedEvent` |
| Client | `ClientCreatedEvent`, `ClientVerifiedEvent`, `ClientRatingSnapshotUpdatedEvent` |
| Errands | `ErrandCreatedEvent`, `ErrandPublishedEvent`, `ErrandAssignedEvent`, `ErrandCompletedEvent`, `ErrandCancelledEvent` |
| Application | `ApplicationSubmittedEvent`, `ApplicationAcceptedEvent`, `ApplicationRejectedEvent`, `ApplicationCancelledEvent`, `ApplicationAcceptanceFailedEvent` |
| Escrow | `EscrowFundedEvent`, `EscrowReleasingEvent`, `EscrowReleasedEvent`, `EscrowRefundingEvent`, `EscrowRefundedEvent`, `EscrowDisputedEvent` |
| Wallet | `ActiveErrandCredited`, `MovedToPending`, `ReleasedToAvailable`, `WithdrawalRecorded`, `ActiveErrandReversed`, `ClientRefunded`, `LedgerDiscrepancyDetected` |
| Rating | `RatingCreatedEvent`, `RatingReactionAddedEvent`, `RatingReactionRemovedEvent`, `RatingRepliedEvent`, `RatingReplyUpdatedEvent` |
| Chat | `ChatRoomCreatedEvent`, `MessageSentEvent`, `MessageReadEvent`, `ParticipantAddedEvent`, `ParticipantRemovedEvent` |
| Dispute | `DisputeOpenedEvent`, `DisputeResolvedEvent` |
| Address | `AddressSavedEvent`, `AddressDeletedEvent`, `AddressSuggestionsResolvedEvent`, `ReverseGeocodeResolvedEvent` |
| Auth | `UserRegisteredEvent`, `UserLoggedInEvent`, `SessionRevokedEvent` |
| Service | `ServiceCatalogRefreshedEvent` |
| Organization | `OrganizationCreatedEvent`, `MemberAddedToOrganizationEvent`, `MemberRemovedFromOrganizationEvent` |
| Trusted Circle | `ProviderAddedToCircleEvent`, `ProviderRemovedFromCircleEvent`, `TrustedCircleSharedEvent` |
| Notification | `NotificationDispatchRequestedEvent`, `NotificationDispatchedEvent`, `NotificationDispatchFailedEvent` |
| Verification | `VerificationCodeSentEvent`, `ProviderVerificationApprovedEvent`, `VerificationExpiredEvent` |
| Payment Gateway | `PaymentMethodAddedEvent`, `PaymentMethodRemovedEvent`, `PaymentSucceededEvent`, `PaymentFailedEvent` |

### Application Jobs

| Module | Scheduler | Processor | Payload |
| --- | --- | --- | --- |
| Escrow | `ReleaseMaturedEscrowsJob` | `ReleaseMaturedEscrowsProcessor` | `ReleaseMaturedEscrowsPayload` |
| Wallet | `ReconcileLedgerJob` | `ReconcileLedgerProcessor` | `ReconcileLedgerPayload` |
| Wallet | `AppendFailedLedgerEntryJob` | `AppendFailedLedgerEntryProcessor` | `AppendFailedLedgerEntryPayload` |
| Notification | `RetryFailedNotificationJob` | `RetryFailedNotificationProcessor` | `RetryFailedNotificationPayload` |
| Verification | `ExpireStaleVerificationsJob` | `ExpireStaleVerificationsProcessor` | `ExpireStaleVerificationsPayload` |

## Critical Event Flows

### Application Acceptance

`AcceptApplicationCommand` persists the accepted application and publishes `ApplicationAcceptedEvent`. `AcceptApplicationSaga` dispatches `FundEscrowCommand`; after Escrow persists funding it publishes `EscrowFundedEvent`, then the saga dispatches `AssignWorkerCommand` and `CancelOtherApplicationsCommand`.

### Errand Completion

`CompleteErrandCommand` persists the completed errand and publishes `ErrandCompletedEvent`. Escrow handles it with `OnErrandCompletedMarkEscrowHandler`, then `MarkEscrowCompletedCommand` moves the escrow into the clearance state and Wallet receives `MoveActiveToPendingCommand`. `ReleaseMaturedEscrowsJob` later enqueues one BullMQ job per matured escrow, and `ReleaseMaturedEscrowsProcessor` dispatches `ReleaseEscrowCommand` and `ReleaseToAvailableCommand`.

### Payment And Wallet Reliability

Payment Gateway records webhooks idempotently and publishes normalized payment events. Wallet appends ledger rows with unique `idempotencyKey` values, updates `WalletBalanceSnapshot` after each successful append, audits gateway references through `ReconcileLedgerJob`, and replays failed external-success/ledger-failure cases through `AppendFailedLedgerEntryProcessor`.

## CQRS Contract

Every command extends `Command<TResult>` and every query extends `Query<TResult>` from `@nestjs/cqrs`. Handlers implement `ICommandHandler<TCommand>` or `IQueryHandler<TQuery>` and are decorated with `@CommandHandler` or `@QueryHandler`. Event handlers implement `IEventHandler<TEvent>` and use `@EventsHandler`. Resolvers, sagas, processors, and event handlers dispatch through the buses.

## GraphQL Contract

Application DTOs are distinct from GraphQL types. GraphQL classes live under `presentation/graphql`, implement explicit presentation shapes, and convert typed IDs to strings through mapper functions such as `toWalletBalancesType` and `toLedgerEntryGraphQLType`.
