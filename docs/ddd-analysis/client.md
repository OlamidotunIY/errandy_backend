# Client — DDD & EIP Analysis

## 1. Current Responsibility

Manages client (job poster) dashboard and profile:

- `getClientDashboard`: Aggregates requirements checklist (payment method, address, email verified), errand counts (active, draft, completed), total spent, wallet balance.
- Builds requirement list for onboarding (what user needs to complete before posting errands).

**Files**: `client.service.ts` (~100 lines seen), `client.resolver.ts`, `client.module.ts`.

## 2. Bounded Context Assessment

**This is a sub-domain of Users**, mirroring Provider.

- Client is a **role-specific profile** — a User can have a Client profile if they post jobs.
- Client profile extends User with client-specific data: payment methods, posted errands, wallet.

**Overlaps**:

- **Users**: Client has `userId` foreign key — tightly coupled to User aggregate (same as Provider).
- **Errands**: Client owns errands (`errand.clientId`), but errand lifecycle is managed by Errands module.
- **Wallet**: Dashboard shows wallet balance, but Wallet module is a stub (balance is queried directly from Prisma).
- **Payment-Gateway**: Client has payment methods, but Payment-Gateway module manages them.

**Verdict**: Client is a **sub-domain of Users**, parallel to Provider. Should be merged with Users (as a child entity) or kept as a separate "Client Management" bounded context.

## 3. Domain Model Audit

**Anemic models**:

- `Client` (Prisma model) is a data bag with `userId`, `paymentMethods`, `errands`.
- No domain behavior:
  - No `Client.canPostErrand()` method (requirements check is in service, line 50+).
  - No `Client.postErrand()` method (errand creation is in Errands module).
  - No `Client.calculateTotalSpent()` method (aggregation is in dashboard query, line 86+).

**Aggregate boundaries**:

- **Option 1: Client as part of User aggregate** (recommended):
  - `User` aggregate owns `Client` as a child entity (like `Provider`).
  - Benefits: Keeps role-switching logic centralized (user can be both client and provider).

- **Option 2: Client as separate aggregate**:
  - `Client` is its own aggregate root with `userId` as a reference.
  - Benefits: Decouples client-specific logic from user profile.

**Recommendation**: Option 1 (merge into User) unless client domain grows complex (e.g., client organizations, budgets, approval workflows).

**Invariants currently unenforced**:

1. **Posting requirements**:
   - `buildRequirements` (line 50+) checks if user has payment method, address, verified email.
   - These are **preconditions** for posting an errand, but not enforced in domain layer (Errands module doesn't check requirements before creating errand).
2. **Wallet consistency**:
   - Dashboard shows wallet balance (line 94+), but no validation that balance matches sum of transactions (ledger integrity).

## 4. Layering Violations

**Business logic in service**:

- `getClientDashboard` (line 22-100+) is a **query / read model**, not a domain service.
- Aggregates data from multiple sources: User, Client, Errand, PaymentMethod, Wallet, Escrow.
- This is fine for a query service, but should be in `application/queries/GetClientDashboard/`.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.user.*`, `this.prisma.errand.*`, `this.prisma.wallet.*`).
- No repository abstraction.

**Requirements logic**:

- `buildRequirements` (line 50+) returns a list of `DashboardRequirement` objects (address missing, payment method missing, etc.).
- This is **UI-specific logic** (what to show on frontend dashboard) — not domain logic.
- However, the underlying **business rules** (user needs payment method to post errand) ARE domain logic — they should be in Client domain as invariants.

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IClientRepository (interface)
    - findById(id): Client | null
    - findByUserId(userId): Client | null
    - save(client): void
infrastructure/
  PrismaClientRepository (implementation)

  queries/
    ClientDashboardQueryService (read model)
      - getDashboard(userId): ClientDashboard
```

**Consolidation**: Write operations (create/update client profile) use repository. Read operations (dashboard) use query service.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **ClientRegistered event**:
   - When user creates Client profile (sets role to CLIENT), emit event.
   - Listeners:
     - Payment-Gateway prompts to add payment method.
     - Notification sends onboarding guide.

2. **ClientRequirementCompleted event**:
   - When client completes a requirement (e.g., adds payment method), emit event.
   - Listeners:
     - Dashboard updates progress bar.
     - Notification sends "you're ready to post your first errand" message.

**Aggregator**:

- `getClientDashboard` aggregates data from 6+ sources (User, Client, Errand, PaymentMethod, Wallet, Escrow).
- This is a legitimate **read model aggregator** — should be in CQRS query handler, separated from domain logic.

**Dead Letter / Retry**:

- Dashboard query can fail if any sub-query fails (e.g., Prisma timeout on errand count).
- No fallback or partial data handling — user sees error instead of partial dashboard.
- Recommendation: Use resilience patterns (circuit breaker, fallback to cached data).

## 7. Cross-Cutting Concerns

**Validation**:

- No validation in ClientService (read-only queries).

**Transactions**:

- Dashboard query is read-only, but uses multiple Prisma calls (line 60-94: `Promise.all([...])`).
- No transaction needed for reads, but could use read replica for performance.

**Error handling**:

- Throws generic `Error` if user not found (line 37).
- If any sub-query in `Promise.all` fails, entire dashboard fails — no graceful degradation.

## 8. GraphQL-Specific Notes

**GraphQL types**:

- `ClientDashboard` (line 11: `ClientDashboard` entity) is a read model DTO, not a domain entity.
- `DashboardRequirement` is a UI-specific type.

**N+1 risk**:

- Dashboard query uses Prisma includes and aggregations — likely optimized (single query per entity type).
- If client code queries `client { errands { applications } }`, potential N+1 — no DataLoader.

**Authorization**:

- No auth checks in ClientService — assumes resolver validates user can only view their own dashboard.

## 9. Target Structure

```
src/client/
  domain/
    entities/
      Client.ts                     # Aggregate root with canPostErrand(), addPaymentMethod()
    value-objects/
      PostingRequirements.ts        # Encapsulates rules: needs payment method + address + verified email
    repositories/
      IClientRepository.ts          # Interface: findById, save
    events/
      ClientRegistered.ts
      ClientRequirementCompleted.ts

  application/
    commands/
      RegisterClient/
        RegisterClientCommand.ts
        RegisterClientHandler.ts
    queries/
      GetClientDashboard/
        GetClientDashboardQuery.ts
        GetClientDashboardHandler.ts  # Read model: aggregates data from multiple sources

  infrastructure/
    repositories/
      PrismaClientRepository.ts
    query-services/
      ClientDashboardQueryService.ts  # Read model for dashboard aggregation

  presentation/
    resolvers/
      ClientResolver.ts
    types/
      ClientDashboardType.ts
      DashboardRequirementType.ts
```

## Persistence Model (Derived from Domain)

```prisma
model Client {
  id String @id @map("_id")
  userId String
  verified Boolean
  averageRating Float?
  createdAt DateTime
  updatedAt DateTime

  @@unique([userId]) // backs: ClientAlreadyExistsError
}
```

Reference fields are scalar IDs only: `userId`. Cleanup owner: `UserDeletedPolicyHandler` deactivates or soft-deletes the Client aggregate through `IClientRepository`; Errand/Escrow history keeps scalar `clientId` values for audit. `id` serves `findById`; unique `userId` serves `findByUserId` and enforces one client profile per user.

---

## 10. Migration Risk & Priority

**Risk**: **LOW-MEDIUM**

- Client module is mostly read-heavy (dashboard queries) with minimal write operations.
- Refactoring dashboard won't break critical flows (payment, errand posting).

**Priority**: **PHASE 2 (parallel with Provider)**
**Rationale**:

1. Client and Provider are symmetric roles — refactor together for consistency.
2. Client module is simpler than Errands/Escrow — good candidate for early refactoring.
3. Extracting client domain logic (posting requirements) unblocks validation in Errands module.

**Migration steps**:

1. **Extract Client aggregate** with `canPostErrand()` method (enforces requirements).
2. **Separate read model from write model** (CQRS):
   - Write: `RegisterClientHandler` uses `IClientRepository`.
   - Read: `GetClientDashboardHandler` uses `ClientDashboardQueryService`.
3. **Introduce IClientRepository** and `PrismaClientRepository`.
4. **Create query service** for dashboard (move aggregation logic out of service).
5. **Emit events**: `ClientRegistered`, `ClientRequirementCompleted`.
6. **Validate posting requirements in Errands module** (before creating errand, check `client.canPostErrand()`).
7. **Add graceful degradation to dashboard** (if one sub-query fails, show partial data instead of error).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Client aggregate root representing a client profile (errand poster).
 * Core invariants:
 * - Client must have associated User (userId must be valid)
 * - Must have payment method before posting paid errands
 * - averageRating is denormalized from Rating table (updated via events)
 * - One client per user (userId is unique)
 */
class ClientId extends EntityId {
  /**
   * Private constructor. Use ClientId.new() or ClientId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new ClientId.
   */
  static new(): ClientId;

  /**
   * Rehydrates ClientId from persisted value.
   */
  static from(value: string): ClientId;
}

/**
 * Client aggregate root representing a client profile (errand poster).
 */
class Client extends AggregateRoot<ClientId> {
  /**
   * Private constructor - use Client.create() factory or load from repository.
   * @param id Unique client identifier (from schema: id String @id)
   * @param userId Associated user ID (from schema: userId String @unique)
   * @param verified Verification status (from schema: verified Boolean)
   * @param averageRating Denormalized average rating (from schema: averageRating Float?)
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: ClientId,
    public readonly userId: UserId,
    private verified: boolean,
    private averageRating: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Factory method to create new client profile.
   * Client starts unverified.
   * @param userId User ID
   * @throws UserNotFoundException when user doesn't exist
   * @throws ClientAlreadyExistsError when user already has client profile
   * @returns New Client instance
   */
  static create(userId: UserId): Client;

  /**
   * Reconstitutes client aggregate from persistence.
   */
  static reconstitute(
    id: ClientId,
    userId: UserId,
    verified: boolean,
    averageRating: number | null,
    createdAt: Date,
    updatedAt: Date,
  ): Client;

  /**
   * Marks client as verified.
   * @emits ClientVerifiedEvent
   */
  verify(): void;

  /**
   * Updates denormalized average rating.
   * Called by event handler when new rating received.
   * @param averageRating New average (1.0-5.0)
   */
  updateAverageRating(averageRating: number): void;

  /**
   * Checks if client can post errands.
   * Currently always true (no strict requirements), but can add payment method check.
   */
  canPostErrand(): boolean;
}

/** Thrown when user already has client profile. */
class ClientAlreadyExistsError extends Error {}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Client aggregate.
 */
interface IClientRepository {
  /**
   * Finds client by unique ID.
   * @param id Client ID
   * @returns Client aggregate or null if not found
   */
  findById(id: ClientId): Promise<Client | null>;

  /**
   * Finds client by user ID.
   * @param userId User ID
   * @returns Client aggregate or null if not found
   */
  findByUserId(userId: UserId): Promise<Client | null>;

  /**
   * Persists client aggregate.
   * @param client Client to save
   */
  save(client: Client): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Creates new client profile.
 */
class CreateClientCommandHandler {
  /**
   * @param command Client creation details
   * @throws UserNotFoundException when user doesn't exist
   * @throws ClientAlreadyExistsError when user already has client profile
   * @emits ClientCreatedEvent
   * @returns Client ID
   */
  execute(command: CreateClientCommand): Promise<ClientId>;
}

interface CreateClientCommand {
  userId: UserId;
}

/**
 * Verifies client.
 */
class VerifyClientCommandHandler {
  /**
   * @param command Verification details
   * @throws ClientNotFoundException when client doesn't exist
   * @emits ClientVerifiedEvent
   */
  execute(command: VerifyClientCommand): Promise<void>;
}

interface VerifyClientCommand {
  clientId: ClientId;
  verifiedBy: UserId; // admin user ID
}

/**
 * Query handler: Get client by ID.
 */
class GetClientQueryHandler {
  /**
   * @param query Client ID
   * @returns Client details with user profile
   * @throws ClientNotFoundException when not found
   */
  execute(query: GetClientQuery): Promise<ClientDTO>;
}

interface GetClientQuery {
  clientId: ClientId;
}

/**
 * Query handler: Get client dashboard.
 * Aggregates errands, applications, ratings.
 */
class GetClientDashboardQueryHandler {
  /**
   * @param query Client ID
   * @returns Dashboard with errand stats, recent errands, etc.
   */
  execute(query: GetClientDashboardQuery): Promise<ClientDashboardDTO>;
}

interface GetClientDashboardQuery {
  clientId: ClientId;
}

interface ClientDTO {
  id: ClientId;
  userId: UserId;
  verified: boolean;
  averageRating: number | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string; image: string | null };
}

interface ClientDashboardDTO {
  client: ClientDTO;
  errandStats: {
    totalErrands: number;
    openErrands: number;
    inProgressErrands: number;
    completedErrands: number;
  };
  recentErrands: Array<{
    id: string;
    title: string;
    status: ErrandStatus;
    createdAt: Date;
  }>;
  totalSpent: number; // kobo
}
```

### Domain Events

```typescript
/**
 * Emitted when new client profile created.
 * Consumed by: Users module (add CLIENT role), Notification
 */
class ClientCreatedEvent {
  constructor(
    public readonly clientId: ClientId,
    public readonly userId: UserId,
  ) {}
}

/**
 * Emitted when client verified.
 * Consumed by: Notification (notify client)
 */
class ClientVerifiedEvent {
  constructor(public readonly clientId: ClientId) {}
}
```

### Event Handlers (React to other module events)

```typescript
/**
 * Listens to RatingCreatedEvent and updates Client.averageRating.
 * Denormalization for performance.
 */
class OnRatingCreatedUpdateClientRatingHandler {
  /**
   * @listens RatingCreatedEvent (when rateeId is client's userId)
   * Recalculates average rating and updates Client aggregate
   */
  handle(event: RatingCreatedEvent): Promise<void>;
}
```
