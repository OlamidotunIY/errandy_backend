# Errands — DDD & EIP Analysis

## 1. Current Responsibility

The Errands module is a **God Module** managing the entire lifecycle of jobs/errands (gig economy tasks): creation, search/discovery (geo-based with `$geoNear`), templates, recurring contracts, bundles, listings, assignment tracking, and saved errands. It directly handles:

- CRUD for `Errand`, `ErrandTemplate`, `ErrandBundle`, `BundleItem`, `SavedErrand`, `RecurringContract`, `ErrandAssignment`
- Complex geospatial queries for personalized feeds (feed, best-match, most-recent, search)
- Status transitions (`DRAFT` → `OPEN` → `IN_PROGRESS` → `COMPLETED`)
- Location auto-update via event listener (`@OnEvent('errand.updated')`)
- Escrow integration (resolver calls `EscrowService.markErrandCompleted`)

**Files**: `errands.resolver.ts` (~300 lines), `errands.service.ts` (~1100+ lines), 17+ DTOs.

## 2. Bounded Context Assessment

**This is THE core bounded context** — the "Job Management" or "Errand Lifecycle" domain.
**Overlaps**:

- **Application**: Errand assignment logic leaks into Application module (applications depend on errand status), but Application should be a sub-domain of Errands.
- **Escrow**: Escrow state transitions are tightly coupled to errand status changes (errand completion triggers escrow release). Escrow is a supporting sub-domain that should listen to errand domain events.
- **Service**: Errands reference `serviceId` for categorization, but this is a value object reference, not a responsibility overlap.

**Verdict**: Real bounded context, but bleeding into Application and overly coupled to Escrow via direct service calls.

## 3. Domain Model Audit

**Anemic models**:

- `Errand` (Prisma model) is passed directly to GraphQL as a data bag. No domain behavior for:
  - Validating status transitions (`DRAFT` → `OPEN` requires price + location set)
  - Enforcing invariants (cannot assign if status ≠ `OPEN`, cannot complete if not assigned)
  - Calculating total cost (base price + transport + materials)
- `ErrandTemplate`, `RecurringContract`, `ErrandBundle` are pure data structures with no behavior.

**Aggregate boundaries**:

- **`Errand`** should be the aggregate root, owning:
  - `SavedErrand` (child entity)
  - `ErrandAssignment` (child entity — worker assignment history)
  - Location (value object, not a raw JSON field)
  - Pricing (value object encapsulating `price`, `hourlyRate`, `transportAllowance`, `materialsBudget`)
- **`ErrandTemplate`** is a separate aggregate (templates exist independently of errands).
- **`RecurringContract`** is a separate aggregate (schedule + pre-acceptance state).

**Invariants currently unenforced**:

1. **Status transitions**:
   - `ErrandsService.update` allows arbitrary status changes (line 173-210) without validation.
   - `EscrowService.markErrandCompleted` enforces status in escrow module (!), not in domain layer.
2. **Assignment rules**:
   - Application acceptance changes `assignedTo` and `status` in Application module (layering violation).
   - No guard preventing multiple assignments (escrow unique constraint is a DB-level check, not domain logic).
3. **Pricing completeness**:
   - No validation that `OPEN` errands have pricing set before posting.
4. **Geo-location consistency**:
   - `serviceAddress` and `location` can drift out of sync. Event listener `handleErrandUpdated` (line 250) tries to fix this reactively, but this is a band-aid for missing invariant.

## 4. Layering Violations

**Resolvers calling Prisma**:

- None directly in `ErrandsResolver`, but resolver calls `EscrowService.markErrandCompleted` (line 112), which is a cross-module business operation disguised as a resolver method. The resolver should call an ErrandApplicationService "CompleteErrand" use case.

**Business logic in service**:

- `ErrandsService` is 1100+ lines of business logic:
  - Geospatial feed algorithms (`getFeedErrands`, `getBestMatchErrands`, line 315+) — this is application logic, but mixed with data access.
  - Priority scoring for matching (line 124: `priorityMatch`, `addFields.priority`) — domain logic for ranking.
  - Location auto-update listener (line 250: `handleErrandUpdated`) — infrastructure concern (event handling) with domain logic (address matching).

**Persistence leaking into domain**:

- `ErrandsService` directly uses Prisma client for everything.
- Methods like `aggregateRaw` (line 93) use MongoDB-specific `$geoNear` aggregation — domain logic is now coupled to MongoDB implementation.
- `GeoPoint` interface (line 24) is a raw MongoDB GeoJSON structure, not a domain value object.

## 5. Repository Pattern Gap

**Current state**: No repository abstraction. `ErrandsService` is both application service AND data access layer.

**Proposed**:

```
domain/
  ErrandRepository (interface)
    - findById(id): Errand
    - findOpenNearLocation(location, maxDistance, filters): Errand[]
    - save(errand): void
    - findByStatus(status): Errand[]
infrastructure/
  PrismaErrandRepository (implementation)
    - Encapsulates all Prisma calls + MongoDB aggregations
    - Maps Prisma types → domain entities
```

**Consolidation**: All Prisma calls in `ErrandsService` (50+ scattered `this.prisma.errand.*` calls) move into `PrismaErrandRepository`.

## 6. EIP Opportunities

**Message Router / Content-Based Router**:

- `getErrands` switch statement (line 297) routes by `ErrandType` enum. This is a manual router that should be:
  - A strategy pattern in the application layer, OR
  - A proper message channel where `ErrandQueryInput` is dispatched to feed-specific query handlers.

**Command/Event patterns**:

1. **ErrandCreated event**: When `create` completes (line 65), emit `ErrandCreated` domain event → listeners:
   - Notification module sends push to nearby providers.
   - Recommendation engine indexes the errand.
2. **ErrandStatusChanged event**: Currently `update` emits `errand.updated` (line 204), but only for location updates (!). Should emit on ALL status changes → listeners:
   - Escrow module reacts to `COMPLETED` status to release funds (instead of resolver calling escrow directly).
   - Application module cancels pending applications when errand moves to `IN_PROGRESS`.
3. **ErrandAssigned event**: Currently handled inline in `EscrowService.acceptApplicationAndFundEscrow`. Should be:
   - `Errand.assignWorker()` method emits event.
   - Escrow module listens and creates escrow.
   - Notification sends assignment confirmation.

**Dead Letter Channel / Retry**:

- `handleErrandUpdated` listener (line 250) silently logs on success but has no retry if Prisma `updateLocation` fails (e.g., DB timeout).
- No dead-letter queue for failed geolocation updates.
- Recommendation: Wrap event handlers in try-catch, push failed events to Redis queue with exponential backoff.

**Aggregator**:

- `getErrands` methods (`getFeedErrands`, `getBestMatchErrands`, line 315+) aggregate data from:
  - User profile (active address, provider type, skills)
  - Errand collection (geospatial + filters)
  - Priority scoring logic

  This is a legitimate aggregator pattern, but should be in a **Query Handler** (CQRS read model), not mixed with service.

## 7. Cross-Cutting Concerns

**Validation**:

- DTOs use `class-validator` (`CreateErrandInput`, etc.), but domain invariants are NOT validated (e.g., no check that `status === OPEN` errands have complete pricing).
- Geo-location validation is missing (can create errand with invalid `location` JSON).

**Transactions**:

- No explicit transactions in `ErrandsService`. Each Prisma call auto-commits.
- `update` (line 173) and `create` (line 50) should be wrapped in use-case-level transactions (create errand + log audit event).

**Error handling**:

- Throws generic `Error` strings (line 41: `'Client not found'`, line 84: `'No active address set'`).
- No domain exceptions (e.g., `ErrandNotOpenForApplications`, `InvalidErrandStatus`).
- `aggregateRaw` has a try-catch for geospatial index errors (line 138), but falls back to a query with different semantics (no distance filtering) — this is hiding a deployment issue, not handling an error.

## 8. GraphQL-Specific Notes

**1:1 Prisma mapping**:

- `Errand` entity is Prisma model + GraphQL type with minimal transformation.
- `PaginatedErrands` (line 24 import) wraps raw Prisma results, not domain objects.

**N+1 risk**:

- `findAll` (line 73) includes `{ ratings: true, client: { user: true, paymentMethods: true } }` — safe for single query.
- `getErrands` → `getFeedErrands` (line 327+) uses aggregation, so no N+1.
- However, if client code iterates `errands.map(e => e.client)`, no DataLoader is in place. **No DataLoader usage found in codebase**.

**Authorization**:

- Resolver-level: `@UseGuards(GqlAuthGuard)` on all mutations/queries.
- Domain-level: Missing. Anyone can call `updateErrand` — no check that current user owns the errand or is the assigned worker.
- Example: `removeErrand` (line 276) deletes ANY errand by ID without owner check (critical security flaw).

## 9. Target Structure

```
src/errands/
  domain/
    entities/
      Errand.ts                    # Rich aggregate root with status transition methods
      ErrandTemplate.ts            # Template aggregate
      RecurringContract.ts         # Recurring contract aggregate
      ErrandAssignment.ts          # Value object / child entity
    value-objects/
      Location.ts                  # Wraps GeoJSON, validates coordinates
      Pricing.ts                   # Encapsulates price/hourly/transport/materials
      ErrandStatus.ts              # Enum + transition rules
    repositories/
      IErrandRepository.ts         # Interface: findById, save, findNearby, etc.
      IErrandTemplateRepository.ts
    services/
      ErrandDomainService.ts       # Domain service for cross-aggregate logic (e.g., match errands to providers)
    events/
      ErrandCreated.ts
      ErrandStatusChanged.ts
      ErrandAssigned.ts

  application/
    commands/
      CreateErrand/
        CreateErrandCommand.ts
        CreateErrandHandler.ts     # Use case: validate, create Errand entity, save via repo, emit event
      AssignErrandToWorker/
        AssignErrandCommand.ts
        AssignErrandHandler.ts
      CompleteErrand/
        CompleteErrandCommand.ts
        CompleteErrandHandler.ts
    queries/
      GetPersonalizedFeed/
        GetPersonalizedFeedQuery.ts
        GetPersonalizedFeedHandler.ts  # Read model: geospatial + priority scoring
      GetErrandById/
        GetErrandByIdQuery.ts
        GetErrandByIdHandler.ts
    event-handlers/
      OnErrandUpdatedLocationSync.ts  # Listens to ErrandUpdated, syncs location from UserAddress

  infrastructure/
    repositories/
      PrismaErrandRepository.ts     # Implements IErrandRepository, encapsulates Prisma + MongoDB aggregations
    persistence/
      ErrandMapper.ts               # Maps Prisma types ↔ domain entities

  presentation/
    resolvers/
      ErrandResolver.ts             # Thin resolver: calls command/query handlers
    dto/
      CreateErrandInput.ts          # GraphQL input, maps to CreateErrandCommand
    types/
      ErrandType.ts                 # GraphQL type, mapped from domain Errand
```

---

## Persistence Model (Derived from Domain)

```prisma
model Errand {
  id String @id @map("_id")
  clientId String
  providerId String?
  serviceId String
  title String
  description String
  status ErrandStatus
  sourceType ErrandSourceType
  location Json
  pricing Json
  attachments Json
  assignedTo String?
  startDate DateTime?
  endDate DateTime?
  createdAt DateTime
  updatedAt DateTime

  @@index([clientId, createdAt]) // serves: findByClientId
  @@index([status]) // serves: findFeedErrands
  @@index([serviceId, status]) // serves: findFeedErrands
  @@index([assignedTo, status]) // serves: assignment cleanup/read models
}
```

Value objects `Location`, `Pricing`, and `ErrandAttachment[]` are embedded. References are scalar IDs only: `clientId`, `providerId`, `serviceId`, `assignedTo`. Cleanup owners: `ClientDeletedPolicyHandler` prevents deleting clients with errands or soft-deletes them; `ProviderDeletedPolicyHandler` clears `providerId`/`assignedTo` only through Errand commands when allowed by status; `ServiceRetiredHandler` keeps `serviceId` for history and prevents hard deletion while errands reference it. `id` serves `findById`; listed indexes serve the repository methods/read models named beside them. No unique constraint is added because the Errand aggregate has no cross-record uniqueness invariant beyond identity.

---

## 11. Migration Risk & Priority

**Risk**: **HIGH**

- Errands is the most critical module (core business domain).
- 14 resolvers depend on `ErrandsService` methods.
- `EscrowService`, `ApplicationService`, `ProviderService` all reference Errand entities.
- Geospatial queries are MongoDB-specific (`$geoNear`) — refactoring requires careful testing to avoid breaking location-based feeds.

**Priority**: **PHASE 2 (after Escrow + Application)**
**Rationale**:

1. Start with **Escrow** (Phase 1) to decouple escrow state from errand operations via domain events.
2. Refactor **Application** (Phase 1) to handle assignment logic, emitting `ErrandAssigned` event.
3. THEN refactor Errands to listen to events instead of direct calls, and enforce status transitions in the domain layer.

**Migration steps**:

1. Extract `Location` and `Pricing` value objects (low risk, immediate benefit).
2. Introduce `IErrandRepository` interface, implement `PrismaErrandRepository` (parallel to existing service).
3. Create `CreateErrandHandler`, `UpdateErrandHandler` command handlers (call repo instead of Prisma).
4. Replace resolver calls to service with calls to command/query handlers.
5. Emit domain events (`ErrandCreated`, `ErrandStatusChanged`) and migrate listeners.
6. Remove direct Prisma calls from service, enforce invariants in Errand entity.

---

## 12. Implementation Spec

### Domain Layer

````typescript
/**
 * Errand aggregate root representing a gig/job posted by a client.
 * Core invariants:
 * - DRAFT errands can be posted only if they have location + pricing
 * - OPEN errands can receive applications
 * - Status transitions: DRAFT → OPEN → (ASSIGNED → IN_PROGRESS → COMPLETED | CANCELLED)
 * - Cannot move backward in status flow
 * - One worker can be assigned at a time (assignedTo is single reference)
 * - sourceType determines whether errand accepts applications (DIRECT cannot)
 */
class ErrandId extends EntityId {
  /**
   * Private constructor. Use ErrandId.new() or ErrandId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new ErrandId.
   */
  static new(): ErrandId;

  /**
   * Rehydrates ErrandId from persisted value.
   */
  static from(value: string): ErrandId;
}

/**
 * Errand aggregate root representing a gig/job posted by a client.
 */
class Errand extends AggregateRoot<ErrandId> {
  /**
   * Private constructor - use Errand.create() factory or load from repository.
   * @param id Unique errand identifier (from schema: id String @id)
   * @param clientId Client who posted errand (from schema: clientId String)
   * @param providerId Optional provider if pre-assigned (from schema: providerId String?)
   * @param serviceId Service category (from schema: serviceId String)
   * @param title Errand title (from schema: title String)
   * @param description Detailed description (from schema: description String)
   * @param status Current status (from schema: status ErrandStatus)
   * @param sourceType How errand was created (from schema: sourceType ErrandSourceType)
   * @param location Location value object (from schema: location Json, serviceAddress String)
   * @param pricing Pricing value object (from schema: price, hourlyRate, transportAllowance, materialsBudget)
   * @param attachments Errand images/documents (from schema: ErrandAttachment[])
   * @param assignedTo Worker ID if assigned (from schema: assignedTo String?)
   * @param startDate Optional start date (from schema: startDate DateTime?)
   * @param endDate Optional end date (from schema: endDate DateTime?)
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: ErrandId,
    public readonly clientId: ClientId,
    public readonly providerId: ProviderId | null,
    public readonly serviceId: ServiceId,
    private title: string,
    private description: string,
    private status: ErrandStatus,
    public readonly sourceType: ErrandSourceType,
    private location: Location,
    private pricing: Pricing,
    private readonly attachments: ErrandAttachment[],
    private assignedTo: ProviderId | null,
    private startDate: Date | null,
    private endDate: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Factory method to create new errand in DRAFT status.
   * Location and pricing can be incomplete for drafts.
   * @param clientId Client posting errand
   * @param serviceId Service category ID
   * @param title Errand title
   * @param description Description
   * @param sourceType How errand was created (SEARCH, DIRECT, etc.)
   * @param providerId Optional provider if pre-assigned (DIRECT source)
   * @returns New Errand instance with status = DRAFT
   */
  static create(
    clientId: ClientId,
    serviceId: ServiceId,
    title: string,
    description: string,
    sourceType: ErrandSourceType,
    providerId: ProviderId | null,
  ): Errand;

  /**
   * Reconstitutes errand aggregate from persistence.
   */
  static reconstitute(
    id: ErrandId,
    clientId: ClientId,
    providerId: ProviderId | null,
    serviceId: ServiceId,
    title: string,
    description: string,
    status: ErrandStatus,
    sourceType: ErrandSourceType,
    location: Location,
    pricing: Pricing,
    attachments: ErrandAttachment[],
    assignedTo: ProviderId | null,
    startDate: Date | null,
    endDate: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): Errand;


  /**
   * Updates errand details (title, description, location, pricing, dates).
   * Can only update DRAFT errands freely. OPEN errands have restrictions.
    * @param updates Partial errand updates
    * @throws InvalidStatusForUpdateError when trying to update non-DRAFT/OPEN errand
    * @emits ErrandUpdatedEvent
   */
  update(updates: Partial<ErrandUpdates>): void;

  /**
   * Publishes errand (DRAFT -> OPEN).
   * Requires location and pricing to be complete.
    * @throws IncompleteErrandError when location or pricing missing
    * @throws InvalidStatusTransitionError when status is not DRAFT
    * @emits ErrandPublishedEvent
   */
  publish(): void;

  /**
   * Assigns worker to errand (OPEN -> ASSIGNED).
   * Called when application is accepted.
    * @param workerId Worker ID being assigned
    * @throws InvalidStatusTransitionError when status is not OPEN
    * @throws WorkerAlreadyAssignedError when errand already has assignedTo
    * @emits ErrandAssignedEvent
   */
  assignWorker(workerId: ProviderId): void;

  /**
   * Starts errand work (ASSIGNED -> IN_PROGRESS).
   * Worker indicates they have started the job.
    * @throws InvalidStatusTransitionError when status is not ASSIGNED
    * @emits ErrandStartedEvent
   */
  start(): void;

  /**
   * Marks errand as complete (IN_PROGRESS -> COMPLETED).
   * Triggers escrow release.
    * @throws InvalidStatusTransitionError when status is not IN_PROGRESS
    * @emits ErrandCompletedEvent
   */
  complete(): void;

  /**
   * Cancels errand (any status -> CANCELLED).
   * Can be cancelled by client before IN_PROGRESS.
    * @param reason Optional cancellation reason
    * @throws CannotCancelCompletedErrandError when status is COMPLETED
    * @emits ErrandCancelledEvent
   */
  cancel(reason?: string): void;

  /**
   * Checks if errand can receive applications.
   * Only OPEN errands with sourceType != DIRECT/RECURRING_CONTRACT/LISTING_HIRE.
   */
  canAcceptApplications(): boolean;

  /**
   * Returns current status.
   */
  getStatus(): ErrandStatus;

  /**
   * Returns location.
   */
  getLocation(): Location;

  /**
   * Returns pricing.
   */
  getPricing(): Pricing;
}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Errand aggregate.
 */
interface IErrandRepository {
  /**
   * Finds errand by Errand.id.
   */
  findById(id: ErrandId): Promise<Errand | null>;


  /**
   * Finds feed errands using geospatial location filter.
   * Uses Errand.location and Errand.status fields.
   */
  findFeedErrands(query: {
    coordinates: [number, number];
    radiusKm: number;
    status: ErrandStatus;
    limit: number;
  }): Promise<Errand[]>;

  /**
   * Finds errands by client owner using Errand.clientId.
   */
  findByClientId(clientId: ClientId): Promise<Errand[]>;

  /**
   * Persists aggregate state changes.
   */
  save(errand: Errand): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Creates errand draft.
 */
class CreateErrandCommandHandler {
  /**
   * Creates errand in DRAFT status and emits ErrandCreatedEvent.
   */
  execute(command: CreateErrandCommand): Promise<ErrandId>;
}

interface CreateErrandCommand {
  clientId: ClientId;
  serviceId: ServiceId;
  title: string;
  description: string;
  sourceType: ErrandSourceType;
  providerId: ProviderId | null;
}

/**
 * Publishes errand draft to OPEN.
 */
class PublishErrandCommandHandler {
  /**
   * Validates completeness and transitions status to OPEN.
   * @emits ErrandPublishedEvent
   */
  execute(command: PublishErrandCommand): Promise<void>;
}

interface PublishErrandCommand {
  errandId: ErrandId;
  publishedBy: ClientId;
}

/**
 * Assigns worker when application acceptance completes.
 */
class AssignWorkerCommandHandler {
  /**
   * Updates Errand.assignedTo and status transition OPEN -> ASSIGNED.
   * @emits ErrandAssignedEvent
   */
  execute(command: AssignWorkerCommand): Promise<void>;
}

interface AssignWorkerCommand {
  errandId: ErrandId;
  workerId: ProviderId;
}

/**
 * Completes active errand.
 */
class CompleteErrandCommandHandler {
  /**
   * Transitions Errand.status IN_PROGRESS -> COMPLETED.
   * @emits ErrandCompletedEvent
   */
  execute(command: CompleteErrandCommand): Promise<void>;
}

interface CompleteErrandCommand {
  errandId: ErrandId;
  completedBy: ClientId | ProviderId;
}
```

### Domain Events

```typescript
/**
 * Emitted when errand draft is created.
 */
class ErrandCreatedEvent {
  constructor(
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly serviceId: ServiceId,
  );
}

/**
 * Emitted when errand is published.
 */
class ErrandPublishedEvent {
  constructor(
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
  );
}

/**
 * Emitted when worker assignment succeeds.
 */
class ErrandAssignedEvent {
  constructor(
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly workerId: ProviderId,
  );
}

/**
 * Emitted when errand completion succeeds.
 */
class ErrandCompletedEvent {
  constructor(
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly workerId: ProviderId,
  );
}
```

### Saga

```typescript
/**
 * Saga for multi-step errand completion flow.
 */
class CompleteErrandSaga {
  /**
   * Triggered by ErrandCompletedEvent.
   * Step 1: request Escrow release.
   * Step 2: trigger wallet transfer from held to worker balance.
   * Step 3: request rating prompt notifications.
   */
  handle(event: ErrandCompletedEvent): Promise<void>;
}

/**
 * Saga for cancellation with potential refund flow.
 */
class RefundErrandSaga {
  /**
   * Triggered by ErrandCancelledEvent.
   * // TODO: Confirm cancellation status gate in module flow before triggering escrow refund.
   */
  handle(event: ErrandCancelledEvent): Promise<void>;
}
```
````
