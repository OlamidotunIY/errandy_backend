# Errandy Backend — DDD & EIP Refactoring Overview

## Executive Summary

This document synthesizes the analysis of all 27 modules in the Errandy Backend codebase (NestJS + GraphQL + Prisma + MongoDB). The analysis identifies opportunities to refactor toward Domain-Driven Design (DDD) and Enterprise Integration Patterns (EIP) for improved maintainability, scalability, and domain clarity.

**Current State**: Transaction Script monolith with anemic domain models, direct Prisma coupling, missing bounded contexts, and scattered business logic.

**Target State**: Event-driven DDD architecture with rich aggregates, repository pattern, CQRS where beneficial, and saga orchestration for complex workflows.

---

## Module Classification

### Core Domain (Bounded Contexts)

**Phase 1 (Critical Money Flows)**:

1. **Escrow** — Process manager disguised as domain service. Orchestrates errand acceptance + payment + wallet updates. **110-line god method, layering violations, missing events**. Priority: PHASE 1, Medium-High risk.
2. **Wallet** — Missing domain (stub service). Logic scattered in Escrow/Payment-Gateway. **Balance integrity unenforced**. Priority: PHASE 1, Low-Medium risk.
3. **Application** — Sub-domain of Errands. Acceptance logic in wrong module (Escrow). **Anemic model, no state transitions**. Priority: PHASE 1, Medium risk.

**Phase 2 (Core Marketplace)**: 4. **Errands** — God Module (1100+ lines). Direct Prisma, MongoDB-specific queries, status transitions unenforced. **Escrow coupling via direct calls**. Priority: PHASE 2, High risk. 5. **Users** — Shared kernel. **URGENT BUG: Dangling activeAddressId on address deletion**. GlobalEventEmitter usage (inconsistent). Priority: PHASE 2, High risk. 6. **Provider** — Worker discovery sub-domain. Read-heavy (CQRS opportunity). **Enrichment pattern, discovery feeds**. Priority: PHASE 2, Medium risk. 7. **Client** — Client dashboard sub-domain. Parallel to Provider. **Requirements validation missing in domain**. Priority: PHASE 2, Low-Medium risk. 8. **Rating** — Reputation bounded context. Read-heavy aggregations. **Denormalization opportunity for performance**. Priority: PHASE 2, Low-Medium risk. 9. **Chat** — Messaging bounded context. **File upload + PubSub orchestration in service layer**. Priority: PHASE 3, Medium risk.

**Phase 3 (Supporting Domains)**: 10. **Trusted-Circle** — Sub-domain of Client. **Merge recommendation: integrate into Client module**. Priority: PHASE 2-3, Low risk. 11. **Service** — Shared kernel (skills catalog). Read-only reference data. **Caching opportunity**. Priority: PHASE 3, Low risk. 12. **Address** — Split: Google Places adapter (infrastructure) + User addresses (Users domain). Priority: PHASE 2, Medium risk. 13. **Verification** — Empty service (stub). **Implement before MVP launch (security risk)**. Priority: PHASE 2, Low risk. 14. **Organization** — Underdeveloped (1 query method). **Defer or implement fully in Phase 3**. Priority: PHASE 3 or DEFER, Low risk. 15. **Dispute** — Empty service (stub). **Defer until MVP stable (complex saga pattern)**. Priority: PHASE 3 or DEFER, Low risk.

### Infrastructure (Cross-Cutting Concerns)

**Correctly Positioned**: 16. **Auth** — Thin adapter (30 lines). Delegates to better-auth. **Untyped events, globalEventEmitter**. Priority: PHASE 3, Low risk. 17. **Email** — Resend adapter. **Queue recommendation for retry**. Priority: PHASE 3, Low risk. 18. **Push** — Firebase Cloud Messaging adapter. **Invalid token cleanup missing**. Priority: PHASE 3, Low risk. 19. **Firebase** — Storage adapter. **Orphaned file cleanup needed**. Priority: PHASE 3, Low risk. 20. **Payment-Gateway** — Paystack adapter. **CRITICAL: Refund failure bug (no retry), queueing needed**. Priority: PHASE 1, High risk. 21. **Notification** — Multi-channel orchestrator (Email + Push). **Event handlers in service (should be separate)**. Priority: PHASE 3, Low risk. 22. **Presence** — Redis-based online status. **Correctly positioned, minimal changes needed**. Priority: PHASE 3, Low risk. 23. **PubSub** — GraphQL subscriptions via Redis. **Decouple domain from PubSub (emit events instead)**. Priority: PHASE 3, Low risk. 24. **Redis** — Configuration module. **Caching layer opportunity**. Priority: PHASE 3, Low risk. 25. **Queues** — BullMQ infrastructure. **Underutilized: queue emails, refunds, file uploads**. Priority: PHASE 1-2, Low risk.

**Misplaced/Leaking Domains**: 26. **Common** — Exception filters. **Audit: ensure no domain logic leaked in**. Priority: PHASE 3 audit. 27. **Config** — GraphQL WebSocket config. **Audit: ensure no domain logic leaked in**. Priority: PHASE 3 audit. 28. **Utils** — **DOMAIN LEAK: Haversine (geospatial) and OTP (verification) are domain logic**. Move to Errands and Verification. Priority: PHASE 2, Medium risk.

---

## Cross-Module Dependency Map

### Critical Dependencies (Strong Coupling)

```
Errands → Escrow (direct method calls: acceptApplicationAndFundEscrow)
Escrow → Errands (updates errand.status directly — layering violation)
Escrow → Application (updates application.status directly)
Escrow → Wallet (creates transactions directly)
Escrow → Payment-Gateway (charges cards directly)

Provider → Rating (enrichment: getProviderRatings batch query)
Provider → TrustedCircle (discovery: queries trusted members)
Client → PaymentMethod (dashboard: checks requirements)
Client → TrustedCircle (owns circle)

Chat → Firebase (file uploads)
Chat → PubSub (message broadcasting)
Users → Address (activeAddressId foreign key — URGENT BUG)
```

### Event-Driven Opportunities (Replace Direct Calls)

```
Application accepted → EscrowFunded → ErrandAssigned
  (Current: Direct calls in EscrowService.acceptApplicationAndFundEscrow)
  (Proposed: AcceptApplicationSaga orchestrates via events)

Errand completed → RatingCreated → ProviderStatsUpdated
  (Current: RatingService aggregates on-demand)
  (Proposed: Denormalize provider rating via event listener)

User created → WelcomeEmailSent
  (Current: NotificationService.handleUserCreated listener — CORRECT)

MessageSent → PubSubBroadcast
  (Current: ChatService calls pubSub.publish directly)
  (Proposed: Event handler listens to MessageSent event → publishes to PubSub)
```

---

## Module Merge/Split Recommendations

### Merges (Reduce Module Count)

1. **Application → Errands**
   **Rationale**: Application is a child entity of Errand (worker applies to errand). Acceptance flow is part of errand lifecycle.
   **Alternative**: Keep separate if application logic grows complex (multi-step approval, background checks).

2. **Trusted-Circle → Client**
   **Rationale**: Trusted circle is client-specific (only clients have circles). Low complexity, 150 lines of code.
   **Alternative**: Keep separate if social features grow (sharing, recommendations, viral growth).

3. **Address (user addresses) → Users**
   **Rationale**: User addresses are part of user profile (child entity). Address service is split: geocoding (infrastructure) vs. user addresses (domain).
   **Keep separate**: Geocoding infrastructure (Google Places adapter).

4. **Verification → Users** (if simple OTP)
   **Rationale**: If verification is simple phone/email OTP, merge into Users as verification workflow.
   **Alternative**: Keep separate if verification is complex (BVN, KYC, background checks).

### Splits (Decouple Concerns)

1. **Escrow → Split into domain + saga**
   **Current**: EscrowService orchestrates errand + application + payment + wallet updates.
   **Proposed**:
   - `Escrow` domain (aggregate with `fund()`, `release()`, `refund()` methods).
   - `AcceptApplicationSaga` (orchestrates Application → Escrow → Errand via events).

2. **Errands → Extract Location/Pricing value objects**
   **Current**: 1100-line service with inline geospatial calculations (MongoDB $geoNear), pricing logic.
   **Proposed**:
   - `Location` value object (encapsulates lat/lng, `distanceTo()` method using haversine from Utils).
   - `Pricing` value object (encapsulates amount, currency, `calculateFee()` method).

3. **Address → Split infrastructure from domain**
   **Current**: AddressService has Google Places API calls (infrastructure) + user address queries (domain).
   **Proposed**:
   - `infrastructure/geocoding/GooglePlacesAdapter` (autocomplete, reverse geocoding).
   - `users/UserAddress` (child entity of User aggregate).

4. **Utils → Extract domain logic**
   **Current**: Utils has haversine (geospatial) and OTP (verification) logic.
   **Proposed**:
   - Move haversine to `errands/domain/value-objects/Location.ts`.
   - Move OTP to `verification/domain/value-objects/OtpCode.ts`.

### Infrastructure Layer Consolidation

**Current**: Infrastructure modules scattered (Email, Push, Firebase, Payment-Gateway, Presence, PubSub, Redis, Queues).
**Proposed**: Group under `infrastructure/` or `common/`:

```
infrastructure/
  email/
    ResendEmailAdapter.ts
  push/
    FcmPushAdapter.ts
  storage/
    FirebaseStorageAdapter.ts
  payment/
    PaystackPaymentAdapter.ts
  geocoding/
    GooglePlacesAdapter.ts
  presence/
    PresenceService.ts
  pubsub/
    RedisPubSubAdapter.ts
  redis/
    redis.module.ts
  queues/
    queues.module.ts
    processors/
      EmailProcessor.ts
      RefundProcessor.ts
```

---

## Migration Roadmap (Phased)

### Phase 1: Decouple Money Flows (4-6 weeks)

**Goal**: Fix critical financial bugs, introduce event-driven escrow/wallet coordination.

**Priority Modules**:

1. **Payment-Gateway**: Queue refunds in BullMQ (CRITICAL: prevent financial loss if refund fails). Extract `PaymentMethodAdded` event.
2. **Wallet**: Implement Wallet aggregate with `credit()`, `debit()`, `hold()`, `release()` methods. Create `IWalletRepository`.
3. **Escrow**: Extract Escrow aggregate with `fund()`, `release()`, `refund()` methods. Create `IEscrowRepository`.
4. **Application**: Extract Application aggregate with `accept()`, `reject()` methods. Create saga: `AcceptApplicationSaga` (orchestrates Application → Escrow → Errand via events).

**Events**:

- `ApplicationAccepted` → `EscrowFunded` → `ErrandAssigned`.
- `ErrandCompleted` → `EscrowReleased` → `WalletCredited`.

**Outcomes**:

- ✅ Payment refund failures are retried (BullMQ).
- ✅ Wallet balance integrity enforced (domain invariants).
- ✅ Escrow state transitions explicit (domain methods).
- ✅ Acceptance flow decoupled (saga orchestration instead of direct calls).

**Risks**:

- High (money flows). Extensive testing required (unit + integration + end-to-end).

---

### Phase 2: Core Domain Refactoring (6-8 weeks)

**Goal**: Extract rich aggregates, introduce repository pattern, fix critical bugs.

**Priority Modules**:

1. **Users**: **URGENT: Fix dangling activeAddressId bug** (delete address → check if active → nullify activeAddressId). Extract `User` aggregate with `updateAddress()`, `deleteAddress()` methods. Create `IUserRepository`. Emit typed events (`UserCreated`, `AddressDeleted`) via EventEmitter2 (replace globalEventEmitter).
2. **Errands**: Extract `Errand` aggregate with `assignWorker()`, `complete()`, `cancel()` methods. Extract `Location` and `Pricing` value objects. Create `IErrandRepository`. Emit events (`ErrandAssigned`, `ErrandCompleted`). Replace MongoDB-specific queries with repository abstractions.
3. **Provider**: Separate read model from write model (CQRS). Create `ProviderDiscoveryQueryService` (read: trusted/new/popular feeds). Create `IProviderRepository` (write: update profile/skills). Denormalize provider rating (cache in Provider table, updated via `RatingCreated` event listener).
4. **Client**: Extract `Client` aggregate with `canPostErrand()` method (enforces posting requirements). Create `ClientDashboardQueryService` (read model). Create `IClientRepository`.
5. **Rating**: Extract `Rating` aggregate with `addReaction()`, `addReply()` methods. Extract `Score` and `Emoji` value objects. Create `IRatingRepository`. Separate read model (rating aggregation) from write model (CQRS). Denormalize average rating in Provider/Client tables (update via `RatingCreated` event).
6. **Trusted-Circle**: Merge into Client module (or keep separate if social features grow). Extract `TrustedCircle` aggregate with `addMember()`, `removeMember()` methods.
7. **Address**: Split into infrastructure (Google Places adapter) and domain (user addresses → merge into Users).
8. **Utils**: Move haversine to Errands (`Location` value object), move OTP to Verification (`OtpCode` value object).

**Events**:

- `UserCreated` → `WelcomeEmailSent`.
- `AddressDeleted` → `ActiveAddressNullified` (if deleted address was active).
- `ErrandAssigned` → `NotifyProvider`.
- `ErrandCompleted` → `EscrowReleased` + `RatingRequested`.
- `RatingCreated` → `ProviderStatsUpdated` (denormalize).

**Outcomes**:

- ✅ Critical bug fixed (Users module).
- ✅ Rich aggregates with domain behavior (no more anemic models).
- ✅ Repository pattern decouples persistence (can switch from Prisma to TypeORM).
- ✅ CQRS improves performance for read-heavy modules (Provider, Client).
- ✅ Domain events enable loose coupling (modules communicate via events, not direct calls).

**Risks**:

- Medium-High (core domain). Extensive testing required. Coordinate with frontend team (GraphQL schema changes).

---

### Phase 3: Infrastructure & Polish (4-6 weeks)

**Goal**: Extract infrastructure adapters, queue background jobs, improve resilience.

**Priority Modules**:

1. **Notification**: Extract event handlers from service (separate files). Queue notifications in BullMQ (retry 3x on failure).
2. **Email**: Extract `IEmailService` interface (port). Rename `EmailService` to `ResendEmailAdapter`. Queue emails in BullMQ.
3. **Push**: Extract `IPushService` interface (port). Rename `PushService` to `FcmPushAdapter`. Queue push notifications in BullMQ. Emit `FcmTokenInvalid` event → cleanup.
4. **Firebase**: Extract `IFileStorageService` interface (port). Rename `FirebaseStorageService` to `FirebaseStorageAdapter`. Queue file uploads in BullMQ. Add orphaned file cleanup (scheduled job).
5. **Chat**: Create `SendMessageCommandHandler` (move file upload + validation + broadcast out of service). Emit `MessageSent` event → event handler publishes to PubSub (decouple domain from PubSub).
6. **Auth**: Create typed event classes (`UserCreated` event). Replace globalEventEmitter with EventEmitter2.
7. **PubSub**: Extract `IPubSubService` interface (port). Decouple domain from PubSub (emit events, event handlers publish to PubSub).
8. **Redis**: Add caching layer (Service catalog, Provider ratings, Errand search results).
9. **Queues**: Create processors (Email, Push, FileUpload, Refund). Add monitoring (queue depth, DLQ size).
10. **Service**: Cache service catalog in Redis (TTL: 1 hour).
11. **Verification**: Implement OTP sending (SMS via Termii, Email via Resend). Emit `PhoneVerified`, `EmailVerified` events.
12. **Presence**: Add logging, error handling, cleanup.
13. **Organization**: Defer or implement fully (if in MVP).
14. **Dispute**: Defer or implement saga (if in MVP).
15. **Common**: Audit for leaked domain logic.
16. **Config**: Audit for leaked domain logic.

**Outcomes**:

- ✅ Infrastructure adapters decoupled (can switch providers: Resend → SendGrid, Firebase → S3, Paystack → Stripe).
- ✅ Background jobs queued (retry on failure, dead-letter queue).
- ✅ Caching improves performance (Redis).
- ✅ Domain fully decoupled from infrastructure (clean architecture).

**Risks**:

- Low (infrastructure refactoring). Incremental rollout possible.

---

## Critical Issues (Fix Immediately)

### 1. Users Module: Dangling activeAddressId Bug

**File**: `users.service.ts` (deleteAddress method)
**Issue**: Deleting address doesn't check if `activeAddressId === deletedAddressId`. Results in dangling foreign key.
**Fix**:

```typescript
async deleteAddress(userId: string, addressId: string) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (user.activeAddressId === addressId) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeAddressId: null },
    });
  }
  await this.prisma.userAddress.delete({ where: { id: addressId } });
}
```

**Priority**: URGENT (data integrity violation).

### 2. Payment-Gateway: Refund Failure (No Retry)

**File**: `payment-gateway.service.ts` (line 149+)
**Issue**: `gateway.refundTransaction()` is called after saving payment method. If refund fails, user is charged 50 Naira without refund.
**Fix**: Queue refund in BullMQ (retry 3x on failure, alert ops if fails).
**Priority**: CRITICAL (financial loss risk).

### 3. Escrow: God Method (110 lines)

**File**: `escrow.service.ts` (acceptApplicationAndFundEscrow method)
**Issue**: Orchestrates 6+ operations (application acceptance, errand update, escrow funding, wallet debit, payment charge) in one method. Violates SRP, hard to test.
**Fix**: Extract saga: `AcceptApplicationSaga` (orchestrates via events).
**Priority**: HIGH (core business flow, maintenance burden).

### 4. Errands: God Service (1100+ lines)

**File**: `errands.service.ts`
**Issue**: 1100+ lines, direct Prisma calls, MongoDB-specific queries, no repository abstraction.
**Fix**: Extract domain aggregates, repository pattern, command/query handlers.
**Priority**: HIGH (core domain, technical debt).

---

## Event-Driven Architecture Patterns

### Domain Events (to Implement)

```typescript
// Users
UserCreated { userId, email, firstName }
AddressDeleted { userId, addressId, wasActive }

// Errands
ErrandCreated { errandId, clientId, location, pricing }
ErrandAssigned { errandId, providerId }
ErrandCompleted { errandId, clientId, providerId }
ErrandCancelled { errandId, reason }

// Application
ApplicationSubmitted { applicationId, errandId, providerId }
ApplicationAccepted { applicationId, errandId, providerId }
ApplicationRejected { applicationId, reason }

// Escrow
EscrowFunded { escrowId, errandId, amount, clientId }
EscrowReleased { escrowId, errandId, amount, providerId }
EscrowRefunded { escrowId, errandId, amount, clientId }

// Wallet
WalletCredited { walletId, userId, amount, source }
WalletDebited { walletId, userId, amount, destination }

// Payment
PaymentMethodAdded { userId, paymentMethodId }
PaymentCharged { paymentMethodId, amount, reference }
PaymentRefunded { reference, amount }

// Rating
RatingCreated { ratingId, errandId, raterId, rateeId, score }
RatingUpdated { ratingId, newScore }

// Chat
MessageSent { messageId, roomId, senderId, content }
MessageRead { messageId, readerId }

// Notification
NotificationSent { userId, channel, type }

// Verification
PhoneVerified { userId, phone }
EmailVerified { userId, email }
```

### Saga Patterns (to Implement)

```typescript
// AcceptApplicationSaga (replaces EscrowService.acceptApplicationAndFundEscrow)
1. ApplicationAccepted event emitted
2. Saga listens → funds escrow (EscrowFunded event)
3. Saga listens → charges payment (PaymentCharged event)
4. Saga listens → debits wallet (WalletDebited event)
5. Saga listens → assigns errand (ErrandAssigned event)
6. Saga listens → notifies provider (NotificationSent event)

// Compensation (if any step fails):
- If payment charge fails → reject application, refund wallet hold.
- If errand assignment fails → refund escrow, refund wallet hold.

// CompleteErrandSaga (future)
1. ErrandCompleted event emitted
2. Saga listens → releases escrow (EscrowReleased event)
3. Saga listens → credits wallet (WalletCredited event)
4. Saga listens → requests ratings (RatingRequested event)
5. Saga listens → notifies client/provider (NotificationSent event)
```

---

## Repository Pattern (Target Interfaces)

### Core Repositories

```typescript
// Errands
IErrandRepository {
  findById(id): Errand | null
  findByClient(clientId): Errand[]
  findNearby(location: Location, radius: number): Errand[]
  save(errand): void
}

// Escrow
IEscrowRepository {
  findById(id): Escrow | null
  findByErrand(errandId): Escrow | null
  save(escrow): void
}

// Wallet
IWalletRepository {
  findByUserId(userId): Wallet | null
  save(wallet): void
}

// Application
IApplicationRepository {
  findById(id): Application | null
  findByErrand(errandId): Application[]
  findByProvider(providerId): Application[]
  save(application): void
}

// Users
IUserRepository {
  findById(id): User | null
  findByEmail(email): User | null
  save(user): void
}

// Provider
IProviderRepository {
  findById(id): Provider | null
  findByUserId(userId): Provider | null
  save(provider): void
}

// Client
IClientRepository {
  findById(id): Client | null
  findByUserId(userId): Client | null
  save(client): void
}

// Rating
IRatingRepository {
  findById(id): Rating | null
  findByErrand(errandId): Rating[]
  findByRatee(rateeId, rateeType): Rating[]
  save(rating): void
}

// Chat
IChatRoomRepository {
  findById(id): ChatRoom | null
  findByParticipant(userId): ChatRoom[]
  save(chatRoom): void
}

// PaymentMethod
IPaymentMethodRepository {
  findById(id): PaymentMethod | null
  findByClientId(clientId): PaymentMethod[]
  save(paymentMethod): void
}

// TrustedCircle
ITrustedCircleRepository {
  findByClientId(clientId): TrustedCircle | null
  save(circle): void
}

// Verification
IVerificationRepository {
  findByUserId(userId): Verification[]
  save(verification): void
}

// Dispute
IDisputeRepository {
  findById(id): Dispute | null
  findByErrand(errandId): Dispute[]
  save(dispute): void
}

// Organization
IOrganizationRepository {
  findById(id): Organization | null
  findByOwnerId(ownerId): Organization[]
  save(organization): void
}
```

---

## CQRS Opportunities (Read/Write Separation)

### Read Models (Query Services)

```typescript
// Provider Discovery (read-heavy)
ProviderDiscoveryQueryService {
  getProvidersByTrust(clientId): Provider[]
  getNewProviders(limit): Provider[]
  getPopularProviders(limit): Provider[]
  getSuggestedProviders(clientId): Provider[]
}

// Client Dashboard (aggregation)
ClientDashboardQueryService {
  getDashboard(userId): ClientDashboard {
    requirements: DashboardRequirement[]
    errandCounts: { active, draft, completed }
    totalSpent: number
    walletBalance: number
  }
}

// Rating Stats (aggregation)
RatingStatsQueryService {
  getProviderStats(providerId): RatingStats
  getProviderRatings(providerIds[]): Map<id, stats>  // Batch query
}

// Errand Search (geospatial + filters)
ErrandSearchQueryService {
  searchNearby(location, radius, filters): Errand[]
  searchByClient(clientId): Errand[]
}
```

### Write Models (Command Handlers)

```typescript
// Errand
CreateErrandCommandHandler
UpdateErrandCommandHandler
AssignErrandCommandHandler
CompleteErrandCommandHandler
CancelErrandCommandHandler

// Application
SubmitApplicationCommandHandler
AcceptApplicationCommandHandler (triggers saga)
RejectApplicationCommandHandler

// Escrow
FundEscrowCommandHandler
ReleaseEscrowCommandHandler
RefundEscrowCommandHandler

// Wallet
CreditWalletCommandHandler
DebitWalletCommandHandler
HoldFundsCommandHandler
ReleaseFundsCommandHandler

// Rating
CreateRatingCommandHandler
ToggleReactionCommandHandler
AddReplyCommandHandler

// Chat
SendMessageCommandHandler
MarkMessageAsReadCommandHandler

// PaymentMethod
AddPaymentMethodCommandHandler
RemovePaymentMethodCommandHandler

// User
UpdateUserProfileCommandHandler
DeleteAddressCommandHandler (fixes dangling activeAddressId bug)
```

---

## Success Metrics

### Technical Metrics

- **Test coverage**: 80%+ (unit + integration).
- **Cyclomatic complexity**: < 10 per method (no more god methods).
- **Module coupling**: < 5 dependencies per module (loose coupling via events).
- **Repository abstraction**: 100% (no direct Prisma calls in domain/application layers).
- **Event-driven**: 80%+ cross-module interactions via events (not direct calls).

### Business Metrics

- **Escrow reliability**: 99.9% (no failed refunds/releases).
- **Payment success rate**: 95%+ (retry logic for transient failures).
- **Notification delivery**: 95%+ (queued, retried on failure).
- **Real-time latency**: < 500ms (GraphQL subscriptions).
- **Errand search performance**: < 200ms (geospatial index + caching).

---

## Next Steps

1. **Review this overview** with team (validate priorities, timelines).
2. **Fix critical bugs** (Users: dangling activeAddressId, Payment-Gateway: refund failure) — Week 1.
3. **Start Phase 1** (Escrow/Wallet/Application refactoring) — Weeks 2-6.
4. **Parallel track**: Queue critical jobs (refunds, emails) in BullMQ — Weeks 2-4.
5. **Start Phase 2** (Errands/Users/Provider refactoring) — Weeks 7-14.
6. **Start Phase 3** (Infrastructure adapters, caching, polish) — Weeks 15-20.
7. **Monitor metrics** (test coverage, complexity, coupling) — Weekly.
8. **Iterate** (adjust priorities based on learnings).

---

## Conclusion

The Errandy Backend codebase has a solid foundation (NestJS, GraphQL, Prisma, MongoDB) but suffers from **anemic domain models, tight coupling, and missing bounded contexts**. The proposed refactoring toward **DDD and EIP** will improve maintainability, scalability, and domain clarity.

**Key Takeaways**:

1. **Critical bugs exist** (Users: dangling activeAddressId, Payment-Gateway: refund failure) — fix immediately.
2. **Escrow is a process manager**, not a domain service — extract saga.
3. **Errands is a god module** — extract aggregates, repository pattern, CQRS.
4. **Event-driven architecture** decouples modules (replace direct calls with events).
5. **Repository pattern** decouples persistence (no more direct Prisma in domain).
6. **CQRS** improves performance (separate read/write models for Provider, Client).
7. **Infrastructure adapters** enable flexibility (switch providers: Resend, Firebase, Paystack).
8. **Queues** improve resilience (retry on failure, dead-letter queue).

**Estimated Timeline**: 14-20 weeks (phased rollout, parallel tracks for critical fixes + queueing).

**Success Criteria**: 80%+ test coverage, < 10 cyclomatic complexity, 100% repository abstraction, 80%+ event-driven cross-module interactions, 99.9% escrow reliability.
