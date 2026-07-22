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

**Goal**: Fix critical financial bugs, introduce event-driven escrow/wallet coordination, fix dangling-reference bugs.

**Priority Modules**:

1. **Payment-Gateway**: Queue refunds in BullMQ (CRITICAL: prevent financial loss if refund fails). Extract `PaymentMethodAdded` event.
2. **Wallet**: Implement Wallet aggregate with `credit()`, `debit()`, `hold()`, `release()` methods. Create `IWalletRepository`.
3. **Escrow**: Extract Escrow aggregate with `fund()`, `release()`, `refund()` methods. Create `IEscrowRepository`.
4. **Application**: Extract Application aggregate with `accept()`, `reject()` methods. Create saga: `AcceptApplicationSaga` (orchestrates Application → Escrow → Errand via events).
5. **Users**: **URGENT: Fix dangling activeAddressId bug** (deleteAddress → nullify activeAddressId if deleting active). Run backfill script to fix existing dangling references in production.
6. **Chat**: **URGENT: Fix dangling lastMessageId bug** (deleteMessage → update ChatRoom.lastMessageId).

**Schema Changes (all additive, low risk)**:

1. **Add cascade rules**:
   - `Application.errandId` → `onDelete: Cascade`
   - `SavedErrand.errandId` → `onDelete: Cascade`
   - `Rating.errandId` → `onDelete: SetNull`
   - `Transaction.errandId` → `onDelete: Restrict` (prevent errand deletion if transactions exist)
   - Migration: `npx prisma db push`
   - Rollback: Safe (cascade rules don't affect existing data, only future deletes)

2. **Add indexes** (performance-critical for money flows):
   - `Application`: `@@index([errandId])`, `@@index([workerId])`
   - Migration: `npx prisma db push`
   - Rollback: Safe (drop indexes without data loss)

3. **Fix dangling references** (code + backfill):
   - Run `scripts/fix-dangling-active-addresses.ts` to clean production data
   - Run `scripts/fix-dangling-last-messages.ts` (if Chat has deleted messages)
   - Rollback: Cannot rollback backfill (one-way data cleanup), but code can be reverted

**Events**:

- `ApplicationAccepted` → `EscrowFunded` → `ErrandAssigned`.
- `ErrandCompleted` → `EscrowReleased` → `WalletCredited`.

**Outcomes**:

- ✅ Payment refund failures are retried (BullMQ).
- ✅ Wallet balance integrity enforced (domain invariants).
- ✅ Escrow state transitions explicit (domain methods).
- ✅ Acceptance flow decoupled (saga orchestration instead of direct calls).
- ✅ **Dangling-reference bugs fixed** (Users.activeAddressId, ChatRoom.lastMessageId).
- ✅ **Financial audit trail protected** (Transaction.errandId cascade prevents orphaning).

**Risks**:

- High (money flows). Extensive testing required (unit + integration + end-to-end).
- **Schema migration risk**: LOW (all changes additive, rollback path exists).
- **Backfill risk**: LOW (backfill scripts idempotent, can re-run if fails).
- **Dual-write complexity**: MEDIUM (Wallet aggregate requires careful transition — emit events AND direct Prisma during rollout).

---

### Phase 2: Core Domain Refactoring (6-8 weeks)

**Goal**: Extract rich aggregates, introduce repository pattern, fix remaining schema gaps, optimize query performance.

**Priority Modules**:

1. **Users**: Extract `User` aggregate with `updateAddress()`, `deleteAddress()` methods (bug already fixed in Phase 1). Create `IUserRepository`. Emit typed events (`UserCreated`, `AddressDeleted`) via EventEmitter2 (replace globalEventEmitter).
2. **Errands**: Extract `Errand` aggregate with `assignWorker()`, `complete()`, `cancel()` methods. Extract `Location` and `Pricing` value objects. Create `IErrandRepository`. Emit events (`ErrandAssigned`, `ErrandCompleted`). Replace MongoDB-specific queries with repository abstractions.
3. **Provider**: Separate read model from write model (CQRS). Create `ProviderDiscoveryQueryService` (read: trusted/new/popular feeds). Create `IProviderRepository` (write: update profile/skills). Denormalize provider rating (cache in Provider table, updated via `RatingCreated` event listener).
4. **Client**: Extract `Client` aggregate with `canPostErrand()` method (enforces posting requirements). Create `ClientDashboardQueryService` (read model). Create `IClientRepository`.
5. **Rating**: Extract `Rating` aggregate with `addReaction()`, `addReply()` methods. Extract `Score` and `Emoji` value objects. Create `IRatingRepository`. Separate read model (rating aggregation) from write model (CQRS). Denormalize average rating in Provider/Client tables (update via `RatingCreated` event).
6. **Trusted-Circle**: Merge into Client module (or keep separate if social features grow). Extract `TrustedCircle` aggregate with `addMember()`, `removeMember()` methods.
7. **Address**: Split into infrastructure (Google Places adapter) and domain (user addresses → merge into Users).
8. **Utils**: Move haversine to Errands (`Location` value object), move OTP to Verification (`OtpCode` value object).

**Schema Changes (performance optimization + denormalization)**:

1. **Add remaining indexes** (critical for core domain queries):
   - `Errand`: `@@index([clientId])`, `@@index([status])`, `@@index([assignedTo])`, `@@index([serviceId])`
   - `Rating`: `@@index([errandId])`, `@@index([rateeId, rateeType])`, `@@index([raterId])`
   - `SavedErrand`: `@@index([userId])`
   - Verify geospatial index exists: `db.errands.getIndexes()` → should see `location_2dsphere`
   - Migration: `npx prisma db push` + manual geo index check
   - Rollback: Safe (drop indexes)

2. **Add denormalized rating fields** (performance optimization for provider discovery):
   - `Provider`: Add `averageRating Float?`, `ratingCount Int @default(0)`
   - `Client`: Add `averageRating Float?`, `ratingCount Int @default(0)`
   - Migration:
     ```bash
     npx prisma db push
     npm run backfill:provider-ratings  # scripts/backfill-provider-ratings.ts
     npm run backfill:client-ratings    # scripts/backfill-client-ratings.ts
     ```
   - Rollback: Safe (fields nullable, remove from schema + db push)
   - Event listener: `RatingCreatedEvent` → update provider/client stats

3. **Add cascade rules for remaining orphan risks**:
   - `Application.workerId` → `onDelete: Cascade` (or SetNull to preserve history)
   - `Errand.assignedTo` → handle via event (`ProviderDeleted` → nullify assignedTo field)
   - Migration: `npx prisma db push`
   - Rollback: Safe

**Events**:

- `UserCreated` → `WelcomeEmailSent`.
- `AddressDeleted` → `ActiveAddressNullified` (if deleted address was active).
- `ErrandAssigned` → `NotifyProvider`.
- `ErrandCompleted` → `EscrowReleased` + `RatingRequested`.
- `RatingCreated` → `ProviderStatsUpdated` (denormalize).

**Outcomes**:

- ✅ **Dangling-reference bugs fully fixed** (all 9 cases handled via cascade rules or event handlers).
- ✅ **Query performance optimized** (13 indexes added, geospatial verified).
- ✅ **Provider discovery performance improved** (denormalized rating stats eliminate aggregation queries).
- ✅ Rich aggregates with domain behavior (no more anemic models).
- ✅ Repository pattern decouples persistence (can switch from Prisma to TypeORM).
- ✅ CQRS improves performance for read-heavy modules (Provider, Client).
- ✅ Domain events enable loose coupling (modules communicate via events, not direct calls).

**Risks**:

- Medium-High (core domain). Extensive testing required. Coordinate with frontend team (GraphQL schema changes).
- **Schema migration risk**: LOW (all changes additive, rollback path exists).
- **Backfill risk**: LOW (rating stats backfill idempotent, eventual consistency acceptable).
- **Denormalization consistency risk**: MEDIUM (rating stats updated via event — if event fails, stats stale until next rating; mitigated by retry queue).

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
**Schema**: `User.activeAddress` relation has `onDelete: NoAction, onUpdate: NoAction` — MongoDB won't nullify.
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

### 2. ChatRoom.lastMessageId Dangling Reference (NEW)

**File**: `chat.service.ts` (message deletion — if implemented)
**Issue**: **Same bug class as activeAddressId**. Deleting a message that is the `ChatRoom.lastMessage` leaves `lastMessageId` pointing to non-existent message.
**Schema**: `ChatRoom.lastMessage` relation has `onDelete: NoAction, onUpdate: NoAction`.
**Impact**: GraphQL queries resolving `ChatRoom.lastMessage` fail or return null unexpectedly.
**Fix**:

```typescript
async deleteMessage(messageId: string) {
  const affectedRooms = await this.prisma.chatRoom.findMany({
    where: { lastMessageId: messageId }
  });

  for (const room of affectedRooms) {
    // Find previous message to set as new lastMessage
    const previousMessage = await this.prisma.message.findFirst({
      where: { roomId: room.id, id: { not: messageId } },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.chatRoom.update({
      where: { id: room.id },
      data: { lastMessageId: previousMessage?.id ?? null },
    });
  }

  await this.prisma.message.delete({ where: { id: messageId } });
}
```

**Priority**: URGENT (data integrity violation, same class as #1).

### 3. Payment-Gateway: Refund Failure (No Retry)

**File**: `payment-gateway.service.ts` (line 149+)
**Issue**: `gateway.refundTransaction()` is called after saving payment method. If refund fails, user is charged 50 Naira without refund.
**Fix**: Queue refund in BullMQ (retry 3x on failure, alert ops if fails).
**Priority**: CRITICAL (financial loss risk).

### 4. Transaction.errandId Orphaned on Errand Deletion (NEW)

**File**: No deletion handler exists
**Issue**: **Financial audit trail bug**. If errand deleted (admin cleanup or future soft-delete feature), all wallet transactions linked to that errand become orphaned (cannot trace payment back to job).
**Schema**: `Transaction.errandId` has no cascade rule.
**Impact**: Audit compliance violation (cannot prove which errand a payment was for).
**Fix**: Add schema constraint `onDelete: Restrict` (prevent errand deletion if transactions exist) OR add `onDelete: SetNull` (preserve transaction but clear errand link).
**Priority**: HIGH (audit/compliance risk).

### 5. Escrow: God Method (110 lines)

**File**: `escrow.service.ts` (acceptApplicationAndFundEscrow method)
**Issue**: Orchestrates 6+ operations (application acceptance, errand update, escrow funding, wallet debit, payment charge) in one method. Violates SRP, hard to test.
**Fix**: Extract saga: `AcceptApplicationSaga` (orchestrates via events).
**Priority**: HIGH (core business flow, maintenance burden).

### 6. Errands: God Service (1100+ lines)

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

## Schema-Level Gaps

This section documents critical schema-level issues found by analyzing `prisma/model/*.prisma` files directly, cross-referenced with service-layer code.

### Aggregate Boundary Violations

**Definition**: Other modules directly mutating a proposed aggregate's internal state via `prisma.<model>.update()` instead of calling the aggregate's domain methods.

1. **Errand aggregate bypassed by EscrowService**
   - **Violating code**: `src/escrow/escrow.service.ts` (lines 198, 1799, 1941) calls `prisma.errand.update({ data: { status: 'COMPLETED' } })` directly.
   - **Schema evidence**: No cascade rules or referential constraints prevent this.
   - **Impact**: Errand status can change without triggering Errand domain logic (state transition guards, events).
   - **Fix**: EscrowService emits `EscrowReleased` event → ErrandEventHandler updates errand status via `Errand.complete()` method.

2. **Wallet aggregate bypassed by EscrowService and PaymentGatewayService**
   - **Violating code**:
     - `src/escrow/escrow.service.ts` (~line 150) calls `prisma.transaction.create()` directly (creates `ESCROW_HOLD` transactions).
     - `src/payment-gateway/payment-gateway.service.ts` (line 180) calls `prisma.wallet.update({ data: { available: { increment } } })` directly.
   - **Schema evidence**: `Wallet` and `Transaction` models have no ownership constraints enforcing that only WalletService can mutate them.
   - **Impact**: Wallet balance can become inconsistent (race conditions, no invariant enforcement, ledger immutability violated).
   - **Fix**: Escrow and Payment-Gateway emit events (`FundsHeld`, `FundsRefunded`) → WalletEventHandler updates wallet via `Wallet.hold()`, `Wallet.credit()` methods.

3. **Application aggregate bypassed by EscrowService**
   - **Violating code**: `src/escrow/escrow.service.ts` (line ~90) updates `application.status` and cancels pending applications directly.
   - **Schema evidence**: `Application` model has `@@unique([errandId, workerId])` but no cascade rules preventing direct updates.
   - **Impact**: Application state transitions can bypass domain logic (e.g., cannot accept if errand no longer OPEN).
   - **Fix**: EscrowService emits `EscrowFunded` event → ApplicationEventHandler updates application via `Application.accept()` method.

4. **User aggregate: activeAddressId dangling reference**
   - **Violating code**: No code currently checks if `User.activeAddressId` points to a deleted `UserAddress` before deletion.
   - **Schema evidence**: `User.activeAddress` relation has `onDelete: NoAction, onUpdate: NoAction` — MongoDB won't cascade or nullify.
   - **Impact**: **CRITICAL BUG** — deleting user's active address leaves dangling foreign key.
   - **Fix**: Already documented in Critical Issues section below. `User.deleteAddress()` must nullify `activeAddressId` if deleting active address.

5. **Rating aggregate: no cascade from Provider/Client deletions**
   - **Violating code**: Deleting Provider or Client doesn't clean up orphaned ratings.
   - **Schema evidence**: `Rating.rateeId` references `Provider.id` or `Client.id` via polymorphic relation (`rateeType` enum), but has no cascade rules.
   - **Impact**: If provider deleted, their ratings remain orphaned (queries by `rateeId` return stale data).
   - **Fix**: Add `onDelete: Cascade` to `Rating.provider` and `Rating.client` relations, OR add event handler (`ProviderDeleted` → delete all ratings).

**Summary**: 5 aggregate roots have boundary violations. All require event-driven refactoring (modules emit events instead of directly mutating other aggregates).

---

### Dangling Reference Bugs (MongoDB No-Cascade Issue)

**Context**: MongoDB + Prisma has no foreign key constraints by default. `onDelete`/`onUpdate` rules are emulated by Prisma client-side, but many relations have `NoAction` or missing cascade rules. Every parent-child reference without cleanup logic is a potential dangling-reference bug.

**Critical bugs found** (same class as `User.activeAddressId` issue):

1. **ChatRoom.lastMessageId → Message** (CRITICAL)
   - **Schema**: `ChatRoom.lastMessage` relation has `onDelete: NoAction, onUpdate: NoAction`.
   - **Bug**: Deleting the last message leaves `ChatRoom.lastMessageId` pointing to non-existent message.
   - **Current cleanup**: None found in `src/chat/`.
   - **Impact**: GraphQL queries resolving `ChatRoom.lastMessage` will fail or return null unexpectedly.
   - **Fix**: On message deletion, if `message.id === room.lastMessageId`, set `room.lastMessageId = null` OR find previous message and update.

2. **Escrow.errandId → Errand** (HIGH)
   - **Schema**: No cascade rule on `Escrow.errand` relation.
   - **Bug**: Deleting errand (unlikely but possible during development/admin cleanup) orphans escrow record.
   - **Current cleanup**: None.
   - **Impact**: Financial audit trail broken (cannot trace escrow back to errand).
   - **Fix**: Add `onDelete: Restrict` (prevent errand deletion if escrow exists) OR add cascade (deleting errand deletes escrow — risky for money records).

3. **Application.errandId → Errand** (MEDIUM)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all applications for that errand.
   - **Current cleanup**: None.
   - **Impact**: Provider's application history incomplete.
   - **Fix**: Add `onDelete: Cascade` (deleting errand cascades to applications).

4. **Application.workerId → Provider** (MEDIUM)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting provider orphans all their applications.
   - **Current cleanup**: None.
   - **Impact**: Errand application history incomplete (cannot show which provider applied).
   - **Fix**: Add `onDelete: Cascade` OR `onDelete: SetNull` (preserve application record but clear `workerId`).

5. **Rating.errandId → Errand** (MEDIUM)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all ratings for that errand.
   - **Current cleanup**: None.
   - **Impact**: Provider/client reputation data incomplete (cannot link rating to originating errand).
   - **Fix**: Add `onDelete: SetNull` (preserve rating but clear `errandId` — rating still shows for provider/client profile).

6. **SavedErrand.errandId → Errand** (LOW)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all `SavedErrand` bookmarks.
   - **Current cleanup**: None.
   - **Impact**: User's saved errands list contains deleted errands (UI shows broken links).
   - **Fix**: Add `onDelete: Cascade` (deleting errand removes from all users' saved lists).

7. **Transaction.errandId → Errand** (CRITICAL for audit)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all wallet transactions linked to that errand.
   - **Current cleanup**: None.
   - **Impact**: Financial audit trail broken (cannot trace payment/escrow back to errand).
   - **Fix**: Add `onDelete: Restrict` (prevent errand deletion if transactions exist) OR preserve transactions with `onDelete: SetNull`.

8. **Errand.assignedTo → Provider** (MEDIUM)
   - **Schema**: `Errand.assignedTo` is a nullable String field (not a formal relation), so no cascade rule possible.
   - **Bug**: Deleting provider leaves `Errand.assignedTo` as a dangling ID.
   - **Current cleanup**: None.
   - **Impact**: Cannot resolve assigned provider (GraphQL query fails or returns null).
   - **Fix**: Add event handler (`ProviderDeleted` → nullify all `Errand.assignedTo` matching deleted provider ID).

9. **Errand.serviceId → Service** (LOW)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting service category orphans all errands using that service.
   - **Current cleanup**: None (deleting services is unlikely — reference data).
   - **Impact**: Errand categorization broken.
   - **Fix**: Add `onDelete: SetNull` OR restrict service deletion if errands exist.

**Summary**: 9 dangling-reference bugs found (3 CRITICAL, 3 MEDIUM, 3 LOW). All require either schema cascade rules OR event-driven cleanup handlers.

---

### Missing Indexes

**Context**: Indexes are critical for query performance, especially for MongoDB geospatial queries and foreign-key-style lookups. Missing indexes cause full collection scans.

**Critical indexes missing**:

1. **Errand.location (2dsphere geospatial index)**
   - **Schema**: `Errand.location` is `Json?` field (GeoJSON `{ type: "Point", coordinates: [lng, lat] }`).
   - **Current index**: NONE (no `@@index` in `errand.prisma`).
   - **Query pattern**: `ErrandsService.getFeedErrands` (line 327+) uses `$geoNear` aggregation for "errands near user's location".
   - **Impact**: `$geoNear` will fail or be extremely slow without 2dsphere index.
   - **Fix**: Run `db.errands.createIndex({ location: "2dsphere" })` (cannot define in Prisma schema — requires manual migration script at `prisma/create-geo-index.ts`).
   - **Migration**: Already exists at `prisma/create-geo-index.ts` (verify it's run on production).

2. **User.activeAddressId**
   - **Schema**: `User.activeAddressId` is `String? @db.ObjectId` field.
   - **Current index**: NONE.
   - **Query pattern**: Not explicitly queried alone, but relation lookup `User.activeAddress` resolves this.
   - **Impact**: LOW (Prisma resolves relation via `User.id → UserAddress.id` lookup, not activeAddressId index).
   - **Fix**: None needed (relation lookup uses UserAddress primary key).

3. **Application.errandId**
   - **Schema**: No `@@index([errandId])`.
   - **Query pattern**: `ApplicationService.errandApplications` (line 75) queries `where: { errandId }`.
   - **Impact**: Full collection scan when fetching applications for an errand (slow as application count grows).
   - **Fix**: Add `@@index([errandId])` to `Application` model.

4. **Application.workerId**
   - **Schema**: No `@@index([workerId])`.
   - **Query pattern**: `ApplicationService.myApplicationForErrand` (line 107) queries `where: { workerId, errandId }` (compound query).
   - **Impact**: Full collection scan when fetching provider's applications.
   - **Fix**: Add `@@index([workerId])` OR compound `@@index([workerId, errandId])`.

5. **Rating.errandId**
   - **Schema**: No `@@index([errandId])`.
   - **Query pattern**: `RatingService.getErrandRatings` queries `where: { errandId }`.
   - **Impact**: Full collection scan when fetching errand reviews.
   - **Fix**: Add `@@index([errandId])`.

6. **Rating.rateeId**
   - **Schema**: No `@@index([rateeId])`.
   - **Query pattern**: `RatingService.getProviderRating` (line 29) queries `where: { rateeId, rateeType }` (compound query).
   - **Impact**: Full collection scan when fetching provider/client ratings (critical for provider discovery performance).
   - **Fix**: Add compound `@@index([rateeId, rateeType])`.

7. **Rating.raterId**
   - **Schema**: No `@@index([raterId])`.
   - **Query pattern**: Future query (user's rating history).
   - **Impact**: LOW (not currently queried).
   - **Fix**: Add `@@index([raterId])` when user rating history feature is implemented.

8. **SavedErrand.errandId**
   - **Schema**: No `@@index([errandId])`.
   - **Query pattern**: Not queried by errandId alone (only by userId).
   - **Impact**: LOW.
   - **Fix**: None needed (userId is more common query path).

9. **SavedErrand.userId**
   - **Schema**: No `@@index([userId])`.
   - **Query pattern**: Likely queried as `where: { userId }` for user's saved errands list.
   - **Impact**: Full collection scan.
   - **Fix**: Add `@@index([userId])`.

10. **Errand.clientId**
    - **Schema**: No `@@index([clientId])`.
    - **Query pattern**: `ErrandsService.findAll` uses `where: { clientId }` when fetching client's errands.
    - **Impact**: Full collection scan (critical for client dashboard).
    - **Fix**: Add `@@index([clientId])`.

11. **Errand.status**
    - **Schema**: No `@@index([status])`.
    - **Query pattern**: `ErrandsService.getFeedErrands` queries `where: { status: ErrandStatus.OPEN }`.
    - **Impact**: Full collection scan when filtering by status.
    - **Fix**: Add `@@index([status])`.

12. **Errand.assignedTo**
    - **Schema**: No `@@index([assignedTo])`.
    - **Query pattern**: Likely queried for provider's assigned errands.
    - **Impact**: Full collection scan.
    - **Fix**: Add `@@index([assignedTo])`.

13. **Errand.serviceId**
    - **Schema**: No `@@index([serviceId])`.
    - **Query pattern**: Filtering errands by service category.
    - **Impact**: Full collection scan.
    - **Fix**: Add `@@index([serviceId])`.

**Summary**: 13 missing indexes (1 CRITICAL geospatial, 12 standard indexes). All are additive schema changes (safe to add without migration/backfill).

---

### Embed vs. Reference Decisions

**Context**: MongoDB allows embedding documents OR referencing by ID. The docs propose denormalizing rating stats into Provider model for performance. This section specifies whether denormalization should be embedded or referenced, and handles partial failure.

1. **Provider rating stats denormalization**
   - **Current**: `RatingService.getProviderRating` (line 29) aggregates ratings on-demand: `_avg.rating`, `_count`.
   - **Proposal**: Cache average rating + count in `Provider` model.
   - **Decision**: **Embedded** — add fields `Provider.averageRating` (Float?), `Provider.ratingCount` (Int).
   - **Justification**:
     - Update frequency: LOW (only when new rating created, ~weekly per provider).
     - Query frequency: HIGH (every provider discovery query).
     - Consistency: Eventual (stale rating OK for discovery, user can click to see real-time).
   - **Event listener implementation**:
     ```typescript
     // rating.events.ts
     @OnEvent('rating.created')
     async handleRatingCreated(event: RatingCreatedEvent) {
       const stats = await this.ratingService.getProviderRating(event.rateeId);
       await this.prisma.provider.update({
         where: { id: event.rateeId },
         data: { averageRating: stats.average, ratingCount: stats.count },
       });
     }
     ```
   - **Partial failure recovery**:
     - If `RatingCreated` event fires but provider update fails (DB timeout):
       - Event is retried (BullMQ queue, 3x retry).
       - If all retries fail, log to dead-letter queue + alert ops.
       - Provider stats will be stale until next rating triggers recalculation.
     - **No rollback** needed (rating creation is committed independently).
     - **Manual fix**: Admin script to recalculate all provider stats from ratings.

2. **Client rating stats denormalization**
   - **Current**: Same as provider (aggregated on-demand).
   - **Proposal**: Cache in `Client` model.
   - **Decision**: **Embedded** — add `Client.averageRating` (Float?), `Client.ratingCount` (Int).
   - **Justification**: Same as provider.
   - **Event listener**: Same pattern as provider.
   - **Partial failure recovery**: Same as provider.

3. **Errand pricing denormalization**
   - **Current**: `Errand.price`, `Errand.hourlyRate`, `Errand.transportAllowance`, `Errand.materialsBudget` are separate fields.
   - **Proposal**: Extract as `Pricing` value object in domain layer (NOT schema change).
   - **Decision**: **NOT embedded in schema** — keep as separate columns for queryability (e.g., filter errands by `price < 5000`).
   - **Justification**: Normalization is fine here (no performance issue, simple fields).

4. **Provider skills/services denormalization**
   - **Current**: `ServicesOnProviders` join table (many-to-many).
   - **Proposal**: Denormalize into Provider for search performance.
   - **Decision**: **Keep normalized** (no change).
   - **Justification**: Services are reference data (low cardinality, ~100 services). Join table query is fast enough with index on `providerId`.

**Summary**: 2 denormalizations (Provider/Client rating stats) as embedded fields. Both use event listeners with retry + dead-letter queue for partial failure recovery. No rollback needed (eventual consistency acceptable).

---

### Migration / Rollback Strategy

**Context**: Prisma + MongoDB doesn't have traditional SQL migrations. Schema changes require `npx prisma db push` (applies schema to DB) or manual scripts. This section specifies migration strategy for Phase 1 and Phase 2 changes.

**Phase 1 (Money Flows) — Migration Complexity**:

1. **Add cascade rules to schema**
   - **Changes**: Add `onDelete: Cascade` to relations (Application → Errand, SavedErrand → Errand, etc.).
   - **Migration type**: Schema push (no data backfill needed).
   - **Command**: `npx prisma db push`.
   - **Rollback**: Safe — cascade rules are forward-only (won't delete existing data, only affect future deletes).
   - **Risk**: LOW.

2. **Add indexes**
   - **Changes**: Add `@@index([errandId])`, `@@index([rateeId, rateeType])`, etc.
   - **Migration type**: Schema push + manual index creation for geospatial.
   - **Command**:
     ```bash
     npx prisma db push
     npm run prisma:create-geo-index  # Runs prisma/create-geo-index.ts
     ```
   - **Rollback**: Safe — indexes can be dropped without data loss.
   - **Risk**: LOW.

3. **Add denormalized fields (Provider.averageRating, Provider.ratingCount)**
   - **Changes**: Add nullable fields to `Provider` and `Client` models.
   - **Migration type**: Schema push + backfill script.
   - **Command**:
     ```bash
     npx prisma db push
     npm run backfill:provider-ratings  # Script: scripts/backfill-provider-ratings.ts
     ```
   - **Backfill script**:
     ```typescript
     // scripts/backfill-provider-ratings.ts
     async function backfillProviderRatings() {
       const providers = await prisma.provider.findMany();
       for (const provider of providers) {
         const stats = await prisma.rating.aggregate({
           where: { rateeId: provider.id, rateeType: 'PROVIDER' },
           _avg: { rating: true },
           _count: true,
         });
         await prisma.provider.update({
           where: { id: provider.id },
           data: {
             averageRating: stats._avg.rating,
             ratingCount: stats._count,
           },
         });
       }
     }
     ```
   - **Rollback**: Safe — fields are nullable, can be removed without breaking queries. Remove fields from schema + `db push`.
   - **Risk**: LOW (backfill is idempotent, can re-run if fails).

4. **Wallet aggregate enforcement (no schema change, code-only)**
   - **Changes**: Escrow/Payment-Gateway emit events instead of direct Prisma calls.
   - **Migration type**: Code deployment (no DB migration).
   - **Rollback**: Code rollback (revert to direct Prisma calls).
   - **Risk**: MEDIUM — need dual-write during transition (emit events AND direct Prisma call) for gradual rollout, then remove direct calls.

5. **Fix User.activeAddressId dangling reference**
   - **Changes**: Update `UsersService.deleteAddress` to nullify `activeAddressId` if deleting active address.
   - **Migration type**: Code deployment (no DB migration).
   - **Backfill**: Check production DB for existing dangling references:
     ```typescript
     // scripts/fix-dangling-active-addresses.ts
     async function fixDanglingActiveAddresses() {
       const users = await prisma.user.findMany({
         where: { activeAddressId: { not: null } },
       });
       for (const user of users) {
         const addressExists = await prisma.userAddress.findUnique({
           where: { id: user.activeAddressId },
         });
         if (!addressExists) {
           await prisma.user.update({
             where: { id: user.id },
             data: { activeAddressId: null },
           });
           console.log(`Fixed dangling activeAddressId for user ${user.id}`);
         }
       }
     }
     ```
   - **Rollback**: Code rollback (but dangling references remain — backfill script is one-way cleanup).
   - **Risk**: LOW (code change is simple, backfill is safe).

**Phase 1 Migration Risks**:

- **No schema changes require data loss or complex transformations**.
- **All migrations are additive** (adding fields, indexes, cascade rules).
- **Rollback path exists for all changes** (drop indexes, remove fields, revert code).
- **Highest risk**: Dual-write for Wallet aggregate (requires careful testing to avoid race conditions).

**Phase 2 (Core Domain Refactoring) — Migration Complexity**:

1. **Extract Location value object from Errand.location**
   - **Changes**: No schema change (location remains Json field). Value object is code-level abstraction.
   - **Migration type**: Code deployment.
   - **Rollback**: Code rollback.
   - **Risk**: LOW.

2. **Move haversine calculation to Errand domain**
   - **Changes**: Code move from `utils/` to `errands/domain/`.
   - **Migration type**: Code deployment.
   - **Rollback**: Code rollback.
   - **Risk**: LOW.

3. **Merge Application into Errands (optional)**
   - **Changes**: No schema change (Application model remains separate).
   - **Migration type**: Code refactoring (move files from `application/` to `errands/application/commands/`).
   - **Rollback**: Code rollback.
   - **Risk**: LOW.

**Phase 2 Migration Risks**:

- **No DB migrations required** (all changes are code refactoring).
- **Rollback is straightforward** (revert code commits).

**Summary**: Phase 1 has 5 DB schema changes (all additive, low risk). Phase 2 has 0 DB schema changes (code-only refactoring). **No breaking changes** that would prevent rollback. **Highest risk** is dual-write for Wallet (requires feature flag + gradual rollout).

---

## Success Metrics

### Technical Metrics

- **Test coverage**: 80%+ (unit + integration).
- **Cyclomatic complexity**: < 10 per method (no more god methods).
- **Module coupling**: < 5 dependencies per module (loose coupling via events).
- **Repository abstraction**: 100% (no direct Prisma calls in domain/application layers).
- **Event-driven**: 80%+ cross-module interactions via events (not direct calls).

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

## Cross-Module Interface Summary

This section provides a comprehensive reference of all key domain interfaces, commands, events, and sagas defined in the Implementation Spec sections (Section 12) of each module document. Use this table to understand cross-module dependencies and event flows.

### Repository Interfaces

| Module              | Repository Interface             | Key Methods                                                                                  | Purpose                                            |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Escrow**          | `IEscrowRepository`              | `findById`, `findByErrand`, `save`                                                           | Persistence contract for Escrow aggregate          |
| **Wallet**          | `IWalletRepository`              | `findById`, `findByOwner`, `save`, `findWalletsWithDiscrepancies`                            | Wallet aggregate persistence + integrity audit     |
| **Application**     | `IApplicationRepository`         | `findById`, `findByErrandAndWorker`, `findByErrand`, `save`, `countByStatus`                 | Application aggregate persistence + queries        |
| **Errands**         | `IErrandRepository`              | `findById`, `findNearby`, `findFeedErrands`, `save`                                          | Errand aggregate persistence + geospatial queries  |
| **Users**           | `IUserRepository`                | `findById`, `findByEmail`, `findByPhoneNumber`, `save`, `findAddresses`                      | Shared kernel user aggregate persistence           |
| **Rating**          | `IRatingRepository`              | `findById`, `findByRater`, `findByRatee`, `save`, `calculateAverageRating`, `getRatingStats` | Rating aggregate persistence + stats aggregation   |
| **Chat**            | `IChatRoomRepository`            | `findById`, `findByErrandAndParticipants`, `findByUser`, `save`, `findMessages`              | Chat room aggregate persistence + messaging        |
| **Provider**        | `IProviderRepository`            | `findById`, `findByUserId`, `findBySkills`, `save`                                           | Provider aggregate persistence + discovery queries |
| **Client**          | `IClientRepository`              | `findById`, `findByUserId`, `save`                                                           | Client aggregate persistence                       |
| **Address**         | `IUserAddressRepository`         | `findByUserId`, `findById`, `save`                                                           | User address persistence for geocoding + profiles  |
| **Auth**            | `IAuthRepository`                | `findIdentityByUserId`, `findIdentityByEmail`, `findSessionByToken`, `saveVerification`      | Auth identity/session lookup + verification store  |
| **Dispute**         | `IDisputeRepository`             | `findById`, `findByErrandId`, `findPendingByErrandId`, `save`                                | Dispute lifecycle persistence                      |
| **Organization**    | `IOrganizationRepository`        | `findById`, `findByOwnerId`, `findByMemberUserId`, `save`                                    | Organization and membership persistence            |
| **Payment-Gateway** | `IPaymentMethodRepository`       | `findById`, `findByUserId`, `findDefaultByUserId`, `save`, `savePaystackCustomer`            | Payment method + provider customer mapping         |
| **Service**         | `IServiceRepository`             | `findAllCategories`, `findServicesByCategoryId`, `findServiceById`                           | Read model for service catalog                     |
| **Trusted-Circle**  | `ITrustedCircleRepository`       | `findById`, `findByClientId`, `save`                                                         | Trusted circle and member persistence              |
| **Verification**    | `IVerificationRepository`        | `findById`, `findByProviderAndType`, `save`                                                  | Provider verification persistence                  |
| **Notification**    | `INotificationHistoryRepository` | `save`                                                                                       | Optional notification delivery history             |
| **Email**           | `IEmailDeliveryRepository`       | `saveDeliveryEvent`                                                                          | Optional provider delivery audit trail             |
| **PubSub**          | `IPubSubAuditRepository`         | `savePublishAudit`                                                                           | Optional broker publish telemetry                  |
| **Push**            | `IPushTokenRepository`           | `deleteToken`                                                                                | Invalid token cleanup contract                     |
| **Presence**        | `IPresenceRepository`            | `setOnline`, `setOffline`, `getPresence`                                                     | Redis presence read/write abstraction              |
| **Redis**           | `IRedisCacheRepository`          | `get`, `set`, `delete`                                                                       | Generic cache repository abstraction               |
| **Queues**          | `IQueueAuditRepository`          | `saveFailedJob`                                                                              | Optional background job failure telemetry          |
| **Common**          | `IErrorAuditRepository`          | `save`                                                                                       | Optional normalized exception audit                |
| **Config**          | `IConfigRepository`              | `getGraphqlWsPolicy`                                                                         | Runtime config access abstraction                  |
| **Firebase**        | `IFileAuditRepository`           | `saveUploadAudit`                                                                            | Optional upload audit persistence                  |
| **Utils**           | `IUtilityOwnershipRepository`    | `listOwnership`                                                                              | Utility ownership metadata for leakage audit       |

### Command Handlers (Write Operations)

| Module              | Command Handler                         | Trigger                          | Purpose                                     | Emits Event                         |
| ------------------- | --------------------------------------- | -------------------------------- | ------------------------------------------- | ----------------------------------- |
| **Escrow**          | `CreateEscrowCommandHandler`            | Application accepted             | Creates escrow for errand                   | `EscrowCreatedEvent`                |
| **Escrow**          | `FundEscrowCommandHandler`              | Payment charged                  | Funds escrow via payment gateway            | `EscrowFundedEvent`                 |
| **Escrow**          | `ReleaseEscrowCommandHandler`           | Errand completed                 | Releases escrow funds to worker             | `EscrowReleasedEvent`               |
| **Escrow**          | `RefundEscrowCommandHandler`            | Errand cancelled                 | Refunds escrow to client                    | `EscrowRefundedEvent`               |
| **Wallet**          | `CreateWalletCommandHandler`            | User registration                | Creates wallet for user                     | `WalletCreatedEvent`                |
| **Wallet**          | `CreditWalletCommandHandler`            | Top-up, refund, payout           | Credits wallet balance                      | `WalletCreditedEvent`               |
| **Wallet**          | `DebitWalletCommandHandler`             | Withdrawal, payment              | Debits wallet balance                       | `WalletDebitedEvent`                |
| **Wallet**          | `HoldFundsCommandHandler`               | Escrow funded                    | Holds funds in wallet (available → held)    | `FundsHeldEvent`                    |
| **Wallet**          | `ReleaseHoldCommandHandler`             | Escrow cancelled                 | Releases held funds (held → available)      | `FundsReleasedEvent`                |
| **Wallet**          | `TransferHeldFundsCommandHandler`       | Escrow released                  | Transfers held funds to worker wallet       | `FundsTransferredEvent`             |
| **Application**     | `SubmitApplicationCommandHandler`       | Worker applies to errand         | Creates application                         | `ApplicationSubmittedEvent`         |
| **Application**     | `AcceptApplicationCommandHandler`       | Client accepts worker            | Accepts application (triggers saga)         | `ApplicationAcceptedEvent`          |
| **Application**     | `RejectApplicationCommandHandler`       | Client rejects worker            | Rejects application                         | `ApplicationRejectedEvent`          |
| **Application**     | `CancelApplicationCommandHandler`       | Worker cancels                   | Cancels application                         | `ApplicationCancelledEvent`         |
| **Errands**         | `CreateErrandCommandHandler`            | Client creates errand            | Creates errand in DRAFT status              | `ErrandCreatedEvent`                |
| **Errands**         | `PublishErrandCommandHandler`           | Client publishes draft           | Publishes errand (DRAFT → OPEN)             | `ErrandPublishedEvent`              |
| **Errands**         | `AssignWorkerCommandHandler`            | Application accepted             | Assigns worker (OPEN → ASSIGNED)            | `ErrandAssignedEvent`               |
| **Errands**         | `StartErrandCommandHandler`             | Worker starts                    | Starts errand (ASSIGNED → IN_PROGRESS)      | `ErrandStartedEvent`                |
| **Errands**         | `CompleteErrandCommandHandler`          | Client/worker completes          | Completes errand (triggers escrow release)  | `ErrandCompletedEvent`              |
| **Errands**         | `CancelErrandCommandHandler`            | Client cancels                   | Cancels errand (triggers escrow refund)     | `ErrandCancelledEvent`              |
| **Users**           | `UpdateUserProfileCommandHandler`       | User updates profile             | Updates user profile                        | `UserProfileUpdatedEvent`           |
| **Users**           | `AddAddressCommandHandler`              | User adds address                | Adds address to user                        | `AddressAddedEvent`                 |
| **Users**           | `DeleteAddressCommandHandler`           | User deletes address             | Deletes address (cleans up activeAddressId) | `AddressDeletedEvent`               |
| **Users**           | `SetActiveAddressCommandHandler`        | User sets active address         | Sets active address                         | `ActiveAddressChangedEvent`         |
| **Users**           | `AddRoleCommandHandler`                 | Provider/Client created          | Adds role to user                           | `RoleAddedEvent`                    |
| **Users**           | `SwitchRoleCommandHandler`              | User toggles role                | Switches active role                        | `ActiveRoleChangedEvent`            |
| **Rating**          | `CreateRatingCommandHandler`            | Errand completed (rating prompt) | Creates rating                              | `RatingCreatedEvent`                |
| **Rating**          | `AddRatingReactionCommandHandler`       | User reacts to rating            | Adds emoji reaction                         | `RatingReactionAddedEvent`          |
| **Rating**          | `AddRatingReplyCommandHandler`          | Ratee replies                    | Adds reply to rating                        | `RatingRepliedEvent`                |
| **Chat**            | `CreateChatRoomCommandHandler`          | Application submitted            | Creates chat room                           | `ChatRoomCreatedEvent`              |
| **Chat**            | `SendMessageCommandHandler`             | User sends message               | Sends message in chat                       | `MessageSentEvent`                  |
| **Chat**            | `MarkMessageAsReadCommandHandler`       | User reads message               | Marks message as read                       | `MessageReadEvent`                  |
| **Provider**        | `CreateProviderCommandHandler`          | User registers as provider       | Creates provider profile                    | `ProviderCreatedEvent`              |
| **Provider**        | `UpdateProviderProfileCommandHandler`   | Provider updates profile         | Updates bio/skills                          | `ProviderProfileUpdatedEvent`       |
| **Provider**        | `VerifyProviderCommandHandler`          | Admin verifies                   | Verifies provider                           | `ProviderVerifiedEvent`             |
| **Client**          | `CreateClientCommandHandler`            | User registers as client         | Creates client profile                      | `ClientCreatedEvent`                |
| **Client**          | `VerifyClientCommandHandler`            | Admin verifies                   | Verifies client                             | `ClientVerifiedEvent`               |
| **Address**         | `GetUserAddressesQueryHandler`          | User opens saved addresses       | Reads user address snapshots                | `AddressSuggestionsResolvedEvent`   |
| **Auth**            | `HandleSignUpCompleteCommandHandler`    | Sign-up completion hook          | Bridges registration into typed events      | `UserRegisteredEvent`               |
| **Auth**            | `HandleLoginSucceededCommandHandler`    | Login success hook               | Emits typed login event                     | `UserLoggedInEvent`                 |
| **Dispute**         | `OpenDisputeCommandHandler`             | Client/worker opens dispute      | Creates dispute in pending state            | `DisputeOpenedEvent`                |
| **Dispute**         | `ResolveDisputeCommandHandler`          | Admin resolution decision        | Accepts/rejects dispute                     | `DisputeResolvedEvent`              |
| **Organization**    | `CreateOrganizationCommandHandler`      | Owner creates organization       | Creates organization aggregate              | `OrganizationCreatedEvent`          |
| **Organization**    | `AddOrganizationMemberCommandHandler`   | Owner/admin adds member          | Adds member to organization                 | `MemberAddedToOrganizationEvent`    |
| **Payment-Gateway** | `AddPaymentMethodCommandHandler`        | User adds card/payment method    | Verifies and saves payment method           | `PaymentMethodAddedEvent`           |
| **Payment-Gateway** | `RemovePaymentMethodCommandHandler`     | User removes payment method      | Removes saved payment method                | `PaymentMethodRemovedEvent`         |
| **Trusted-Circle**  | `AddToTrustedCircleCommandHandler`      | Client adds trusted provider     | Adds member to trusted circle               | `ProviderAddedToCircleEvent`        |
| **Trusted-Circle**  | `RemoveFromTrustedCircleCommandHandler` | Client removes trusted provider  | Removes member from trusted circle          | `ProviderRemovedFromCircleEvent`    |
| **Verification**    | `SendVerificationCodeCommandHandler`    | Verification requested           | Issues verification challenge               | `VerificationCodeSentEvent`         |
| **Verification**    | `VerifyCodeCommandHandler`              | Verification response submitted  | Approves/rejects verification               | `ProviderVerificationApprovedEvent` |
| **Notification**    | `SendNotificationCommandHandler`        | Domain event fan-out             | Sends multi-channel notifications           | `NotificationDispatchedEvent`       |
| **Email**           | `QueueEmailCommandHandler`              | Email send request               | Queues provider email delivery              | `EmailQueuedEvent`                  |
| **Push**            | `SendPushNotificationCommandHandler`    | Push send request                | Sends FCM notification                      | `PushNotificationSentEvent`         |
| **PubSub**          | `BroadcastDomainEventCommandHandler`    | Domain event bridge              | Publishes payload to topic subscribers      | `PubSubMessagePublishedEvent`       |
| **Presence**        | `UpdatePresenceCommandHandler`          | WebSocket connect/disconnect     | Updates user presence state                 | `PresenceChangedEvent`              |
| **Queues**          | `EnqueueJobCommandHandler`              | Async side-effect request        | Queues background processing jobs           | `QueueJobEnqueuedEvent`             |
| **Redis**           | `ReadThroughCacheQueryHandler`          | Cache-backed read                | Performs read-through cache strategy        | `CacheEntrySetEvent`                |
| **Common**          | `RecordExceptionAuditHandler`           | Exception captured               | Persists normalized exception metadata      | `ExceptionMappedEvent`              |
| **Config**          | `ValidateWsConnectionCommandHandler`    | GraphQL WS connection            | Validates WS auth/config policy             | `WsClientConnectedEvent`            |
| **Firebase**        | `UploadFileCommandHandler`              | File upload request              | Stores file via adapter and tracks audit    | `FileUploadedEvent`                 |
| **Service**         | `GetServicesByCategoryQueryHandler`     | Service catalog query            | Returns services filtered by category       | `ServiceCatalogRefreshedEvent`      |
| **Utils**           | `AuditUtilityOwnershipCommandHandler`   | Utility audit run                | Flags domain leakage in shared utils        | `UtilityDomainLeakDetectedEvent`    |

### Domain Events (Critical Event Flows)

| Event                      | Module      | Consumer Modules                                          | Purpose                                             | Saga Trigger?                   |
| -------------------------- | ----------- | --------------------------------------------------------- | --------------------------------------------------- | ------------------------------- |
| `ApplicationAcceptedEvent` | Application | Errands, Escrow, Notification                             | **CRITICAL: Triggers AcceptApplicationSaga**        | ✅ Yes (AcceptApplicationSaga)  |
| `ErrandAssignedEvent`      | Errands     | Escrow, Application, Notification                         | Worker assigned to errand                           | No                              |
| `ErrandCompletedEvent`     | Errands     | **Escrow** (release funds), Rating (prompt), Notification | **CRITICAL: Triggers escrow release**               | No (CompleteErrandSaga listens) |
| `ErrandCancelledEvent`     | Errands     | **Escrow** (refund), Application (cancel), Notification   | **CRITICAL: Triggers escrow refund if IN_PROGRESS** | No (RefundErrandSaga listens)   |
| `EscrowFundedEvent`        | Escrow      | **Wallet** (hold funds), Application saga                 | Escrow payment successful                           | No                              |
| `EscrowReleasedEvent`      | Escrow      | **Wallet** (transfer to worker), Notification             | Escrow funds released to worker                     | No                              |
| `EscrowRefundedEvent`      | Escrow      | **Wallet** (release to client), Notification              | Escrow funds refunded to client                     | No                              |
| `WalletCreditedEvent`      | Wallet      | Notification                                              | Wallet balance credited                             | No                              |
| `WalletDebitedEvent`       | Wallet      | Notification                                              | Wallet balance debited                              | No                              |
| `FundsHeldEvent`           | Wallet      | AcceptApplicationSaga (next step)                         | Funds held in client wallet                         | No                              |
| `FundsTransferredEvent`    | Wallet      | Notification                                              | Funds transferred between wallets                   | No                              |
| `RatingCreatedEvent`       | Rating      | **Provider/Client** (update averageRating), Notification  | **CRITICAL: Triggers denormalization**              | No                              |
| `MessageSentEvent`         | Chat        | **PubSub** (broadcast), Notification                      | **CRITICAL: Triggers real-time broadcast**          | No                              |
| `ProviderCreatedEvent`     | Provider    | **Users** (add PROVIDER role)                             | Provider profile created                            | No                              |
| `ClientCreatedEvent`       | Client      | **Users** (add CLIENT role)                               | Client profile created                              | No                              |
| `UserProfileUpdatedEvent`  | Users       | Payment-Gateway (update Paystack), Notification           | User profile updated                                | No                              |
| `AddressDeletedEvent`      | Users       | Errands (cleanup references)                              | Address deleted (may affect errands)                | No                              |

### Sagas (Multi-Step Workflows)

| Saga                          | Trigger Event                                        | Module      | Steps                                                                                                                                                                      | Rollback Strategy                             | Risk Level                              |
| ----------------------------- | ---------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------- |
| **AcceptApplicationSaga**     | `ApplicationAcceptedEvent`                           | Application | 1. Reject other applications<br>2. Update errand status to ASSIGNED<br>3. Create escrow<br>4. Charge payment<br>5. Hold funds in wallet<br>6. Update errand to IN_PROGRESS | Revert application to PENDING, errand to OPEN | **HIGH** (money flow)                   |
| **CompleteErrandSaga**        | `ErrandCompletedEvent`                               | Errands     | 1. Release escrow<br>2. Transfer held funds to worker<br>3. Prompt rating<br>4. Send notifications                                                                         | N/A (completion is terminal)                  | **MEDIUM** (money flow, but idempotent) |
| **RefundErrandSaga**          | `ErrandCancelledEvent` (when status was IN_PROGRESS) | Errands     | 1. Refund escrow<br>2. Release held funds to client<br>3. Cancel applications<br>4. Send notifications                                                                     | N/A (refund is terminal)                      | **MEDIUM** (money flow, but idempotent) |
| **CreateErrandSaga** (future) | `ErrandPublishedEvent`                               | Errands     | 1. Notify nearby providers<br>2. Index in search<br>3. Update recommendation engine                                                                                        | N/A (informational only)                      | **LOW**                                 |

### Value Objects (Shared Domain Concepts)

| Value Object    | Module                  | Properties                                                                                                     | Validation                                | Purpose                                                 |
| --------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| **Money**       | Wallet, Escrow, Errands | `amountKobo: number`                                                                                           | Must be non-negative                      | Represents monetary amount in kobo (1 Naira = 100 kobo) |
| **Location**    | Errands, Users          | `geoPoint: GeoPoint`, `address: string`, `placeId?: string`                                                    | Valid coordinates                         | Geospatial location with address                        |
| **Pricing**     | Errands                 | `price: number \| null`, `hourlyRate: number \| null`, `transportAllowance: number`, `materialsBudget: number` | At least one of price/hourlyRate required | Errand pricing structure                                |
| **Score**       | Rating                  | `value: number`                                                                                                | 1-5 range                                 | Rating score                                            |
| **Emoji**       | Rating                  | `value: string`                                                                                                | Allowed emoji set only                    | Validated emoji reaction                                |
| **Email**       | Users                   | `value: string`                                                                                                | Valid email format                        | Validated email address                                 |
| **PhoneNumber** | Users                   | `value: string`                                                                                                | Valid phone format (E.164 recommended)    | Validated phone number                                  |

### Cross-Module Event Flow Examples

#### Errand Acceptance Flow (AcceptApplicationSaga)

```
1. Client calls AcceptApplicationCommandHandler
2. Application.accept() → emits ApplicationAcceptedEvent
3. AcceptApplicationSaga handles ApplicationAcceptedEvent:
   a. Calls RejectApplicationCommand for other applications
   b. Calls AssignWorkerCommand → emits ErrandAssignedEvent
   c. Calls CreateEscrowCommand → emits EscrowCreatedEvent
   d. Calls FundEscrowCommand → emits EscrowFundedEvent
   e. OnEscrowFundedHoldFundsHandler calls HoldFundsCommand → emits FundsHeldEvent
   f. Calls UpdateErrandStatusCommand (IN_PROGRESS)
4. Notifications sent to worker (accepted) and client (charged)
```

#### Errand Completion Flow

```
1. Client/Worker calls CompleteErrandCommandHandler
2. Errand.complete() → emits ErrandCompletedEvent
3. OnErrandCompletedReleaseEscrowHandler calls ReleaseEscrowCommand → emits EscrowReleasedEvent
4. OnEscrowReleasedTransferFundsHandler calls TransferHeldFundsCommand → emits FundsTransferredEvent + WalletCreditedEvent
5. OnErrandCompletedPromptRatingHandler sends rating prompts to client and worker
6. Notifications sent to worker (payment received) and client (errand complete)
```

#### Chat Message Flow

```
1. User calls SendMessageCommandHandler
2. ChatRoom.sendMessage() → emits MessageSentEvent
3. OnMessageSentBroadcastHandler publishes to PubSub topic (real-time delivery to connected users)
4. Notification module sends push notification to offline participants
```

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
