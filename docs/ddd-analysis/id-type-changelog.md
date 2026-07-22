# ID Typing Changelog (Step 6)

This changelog lists all ddd-analysis files modified during the typed-ID correction work.

Legend:

- ID class added: Added a strongly-typed ID class in Implementation Spec.
- AggregateRoot updated: Aggregate root now extends AggregateRoot<TId> in Implementation Spec.
- Repository updated: Repository interface signatures use typed IDs (instead of bare string for aggregate identity).
- Events/handlers updated: Command/query DTOs and domain events use typed IDs for aggregate identities.

| File                   | ID class added | AggregateRoot updated | Repository updated | Events/handlers updated | Notes                                                                                   |
| ---------------------- | -------------- | --------------------- | ------------------ | ----------------------- | --------------------------------------------------------------------------------------- |
| 00-shared-kernel.md    | Yes            | Yes                   | N/A                | N/A                     | Added shared EntityId and AggregateRoot<TId> base spec.                                 |
| 00-overview.md         | N/A            | N/A                   | Yes                | N/A                     | Cross-Module Interface Summary updated to typed ID signatures.                          |
| address.md             | Yes            | Yes                   | Yes                | Yes                     | Address identities typed (AddressId, UserId).                                           |
| application.md         | Yes            | Yes                   | Yes                | Yes                     | Application aggregate signatures typed (ApplicationId, ErrandId, ProviderId, ClientId). |
| auth.md                | Yes            | Yes                   | Yes                | Yes                     | AuthIdentity/Session signatures typed (AuthIdentityId, SessionId, UserId).              |
| chat.md                | Yes            | Yes                   | Yes                | Yes                     | Chat room/message signatures typed (ChatRoomId, MessageId, UserId, ErrandId).           |
| client.md              | Yes            | Yes                   | Yes                | Yes                     | Client aggregate signatures typed (ClientId, UserId).                                   |
| config.md              | N/A            | N/A                   | N/A                | Yes                     | Identity references in events/DTOs typed where aggregate-related.                       |
| dispute.md             | Yes            | Yes                   | Yes                | Yes                     | Dispute aggregate signatures typed (DisputeId, ErrandId, ClientId, ProviderId).         |
| errands.md             | Yes            | Yes                   | Yes                | Yes                     | Errand aggregate signatures typed (ErrandId, ClientId, ProviderId, ServiceId).          |
| escrow.md              | Yes            | Yes                   | Yes                | Yes                     | Escrow aggregate signatures typed (EscrowId, ErrandId, ClientId, ProviderId).           |
| notification.md        | N/A            | N/A                   | Yes                | Yes                     | Recipient identity references typed (UserId).                                           |
| organization.md        | Yes            | Yes                   | Yes                | Yes                     | Organization/member signatures typed (OrganizationId, OrgMemberId, UserId).             |
| payment-gateway.md     | Yes            | Yes                   | Yes                | Yes                     | Payment method aggregate signatures typed (PaymentMethodId, UserId).                    |
| presence.md            | N/A            | N/A                   | Yes                | Yes                     | Presence identity references typed (UserId).                                            |
| provider.md            | Yes            | Yes                   | Yes                | Yes                     | Provider aggregate signatures typed (ProviderId, UserId).                               |
| push.md                | N/A            | N/A                   | Yes                | Yes                     | Push recipient/user identity references typed (UserId).                                 |
| rating.md              | Yes            | Yes                   | Yes                | Yes                     | Rating aggregate signatures typed (RatingId, UserId, ErrandId).                         |
| service.md             | Yes            | Yes                   | Yes                | Yes                     | Service category and service IDs typed (ServiceCategoryId, ServiceId).                  |
| trusted-circle.md      | Yes            | Yes                   | Yes                | Yes                     | Trusted circle signatures typed (TrustedCircleId, ClientId, ProviderId).                |
| users.md               | Yes            | Yes                   | Yes                | Yes                     | User/address signatures typed (UserId, AddressId).                                      |
| verification.md        | Yes            | Yes                   | Yes                | Yes                     | Verification signatures typed (VerificationId, ProviderId).                             |
| wallet.md              | Yes            | Yes                   | Yes                | Yes                     | Wallet signatures typed (WalletId and related cross-module IDs).                        |
| id-type-audit-step2.md | N/A            | N/A                   | N/A                | N/A                     | Audit artifact captured before Step 3 edits.                                            |

## Ambiguities / intentionally unchanged

- Non-aggregate technical IDs remain as string where appropriate: traceId, correlationId, providerMessageId, templateId, eventId, placeId.
- External-provider mapping identifiers (for example payment customer/provider IDs) remain as string where they are not domain aggregate identities.
