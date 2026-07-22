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

## 10. Schema Findings

**Context**: Analysis of `prisma/model/errand.prisma` and cross-module references.

### Aggregate Boundary Violations

1. **EscrowService directly mutates Errand.status**
   - **Evidence**: `src/errands/errands.service.ts` (lines 198, 1799, 1941) calls `prisma.errand.update({ data: { status: 'COMPLETED' } })` from within Escrow module.
   - **Schema gap**: No protection preventing other modules from bypassing Errand aggregate.
   - **Impact**: Errand status can change without triggering Errand domain logic (state transition validation, event emission).
   - **Fix priority**: PHASE 1 — Escrow emits `EscrowReleased` event → `ErrandEventHandler.handleEscrowReleased()` calls `Errand.complete()`.
   - **Migration notes**: Code-only refactoring (no schema change). Risk: MEDIUM (need to coordinate Errand + Escrow event flow).

### Dangling Reference Risks

1. **Application.errandId → Errand**
   - **Schema**: `Application.errandId` has no cascade rule.
   - **Bug**: Deleting errand orphans all applications for that errand.
   - **Impact**: MEDIUM — provider's application history incomplete.
   - **Current cleanup**: None (errand deletion not implemented yet).
   - **Fix**: Add `onDelete: Cascade` to `Application.errand` relation (deleting errand cascades to applications).
   - **Migration**: `npx prisma db push` (additive).
   - **Rollback**: Safe (remove cascade rule).
   - **Priority**: PHASE 1 (before errand deletion feature).

2. **SavedErrand.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all saved errand bookmarks.
   - **Impact**: LOW — UI shows broken links in user's saved list.
   - **Fix**: Add `onDelete: Cascade`.
   - **Priority**: PHASE 1.

3. **Rating.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all ratings for that errand.
   - **Impact**: MEDIUM — cannot link rating to originating job.
   - **Fix**: Add `onDelete: SetNull` (preserve rating for provider/client profile, but clear errand link).
   - **Priority**: PHASE 2.

4. **Transaction.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans wallet transactions.
   - **Impact**: **CRITICAL** — financial audit trail broken.
   - **Fix**: Add `onDelete: Restrict` (prevent errand deletion if transactions exist) OR coordinate with Wallet module.
   - **Priority**: PHASE 1 (documented in Wallet module findings).

5. **Escrow.errandId → Errand**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans escrow record.
   - **Impact**: **HIGH** — financial audit trail broken.
   - **Fix**: Add `onDelete: Restrict`.
   - **Priority**: PHASE 1 (documented in Escrow module findings).

6. **Errand.assignedTo → Provider** (field-level dangling reference)
   - **Schema**: `Errand.assignedTo` is a nullable String field (not a formal Prisma relation), so no cascade rule possible.
   - **Bug**: Deleting provider leaves `assignedTo` as dangling ID.
   - **Impact**: MEDIUM — cannot resolve assigned provider in GraphQL queries.
   - **Current cleanup**: None.
   - **Fix**: Add event handler: `ProviderDeleted` → nullify all `Errand.assignedTo` matching deleted provider ID.
   - **Migration**: Code deployment (event handler).
   - **Rollback**: Code revert.
   - **Priority**: PHASE 2.

7. **Errand.serviceId → Service**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting service category orphans errands.
   - **Impact**: LOW (services are reference data, deletion unlikely).
   - **Fix**: Add `onDelete: SetNull` OR restrict service deletion if errands exist.
   - **Priority**: PHASE 3 (defer until service management implemented).

### Missing Indexes

**Critical index confirmed present**:

- ✅ **Errand.location (2dsphere geospatial index)**: Verified via `prisma/create-geo-index.ts` script.
  - **Query pattern**: `ErrandsService.getFeedErrands` uses `$geoNear` aggregation.
  - **Migration**: Already handled by existing script (must verify it's run on production).

**Missing indexes found**:

1. **Errand.clientId** (CRITICAL for client dashboard)
   - **Query pattern**: `ErrandsService.findAll` queries `where: { clientId }`.
   - **Impact**: Full collection scan when fetching client's errands.
   - **Fix**: Add `@@index([clientId])`.
   - **Priority**: PHASE 2.

2. **Errand.status** (HIGH for filtering open errands)
   - **Query pattern**: `ErrandsService.getFeedErrands` queries `where: { status: ErrandStatus.OPEN }`.
   - **Impact**: Full collection scan when filtering by status.
   - **Fix**: Add `@@index([status])`.
   - **Priority**: PHASE 2.

3. **Errand.assignedTo** (MEDIUM for provider's assigned errands)
   - **Query pattern**: Future feature (provider dashboard showing assigned errands).
   - **Impact**: Full collection scan.
   - **Fix**: Add `@@index([assignedTo])`.
   - **Priority**: PHASE 2.

4. **Errand.serviceId** (MEDIUM for service-based filtering)
   - **Query pattern**: Filtering errands by service category.
   - **Impact**: Full collection scan.
   - **Fix**: Add `@@index([serviceId])`.
   - **Priority**: PHASE 2.

5. **ErrandAssignment.errandId** ✅ (already has `@@index([errandId])` — confirmed).

**Schema changes needed**:

```prisma
model Errand {
  // ... existing fields ...

  @@index([clientId])
  @@index([status])
  @@index([assignedTo])
  @@index([serviceId])
  @@map("errands")
}
```

**Migration**: `npx prisma db push` (additive, no backfill).
**Rollback**: Safe (drop indexes).

### Embed vs. Reference Decisions

**Not applicable for Errand core fields** — all fields remain normalized (no denormalization proposed).

**Note on Location value object**:

- **Current**: `Errand.location` is `Json?` field (GeoJSON `{ type: "Point", coordinates: [lng, lat] }`).
- **Proposal**: Extract `Location` value object in domain layer (code-level abstraction, NOT schema change).
- **Justification**: Keep as JSON in schema for queryability (MongoDB geospatial queries require GeoJSON format).
- **Domain layer**: `Location` value object wraps JSON, provides `distanceTo()` method using haversine.

**Note on Pricing value object**:

- **Current**: `Errand.price`, `Errand.hourlyRate`, `Errand.transportAllowance`, `Errand.materialsBudget` are separate columns.
- **Proposal**: Extract `Pricing` value object in domain layer (code-level abstraction, NOT schema change).
- **Justification**: Keep as separate columns for queryability (filter errands by `price < 5000`).

### Migration / Rollback Strategy

**Phase 2 changes for Errands** (deferred until after Escrow/Application refactored):

1. **Add cascade rules** (5 dangling-reference fixes):
   - `Application.errandId` → `onDelete: Cascade`
   - `SavedErrand.errandId` → `onDelete: Cascade`
   - `Rating.errandId` → `onDelete: SetNull`
   - `Escrow.errandId` → `onDelete: Restrict`
   - Transaction handled in Wallet module
   - Migration: `npx prisma db push`
   - Rollback: Safe (remove constraints)
   - Risk: LOW

2. **Add indexes** (4 missing indexes):
   - Migration: `npx prisma db push`
   - Rollback: Safe (drop indexes)
   - Risk: LOW

3. **Add event handler for Provider deletion** (Errand.assignedTo):
   - Migration: Code deployment
   - Rollback: Code revert
   - Risk: LOW

4. **Extract Errand aggregate + events** (code-only):
   - Create `Errand.assignWorker()`, `Errand.complete()`, `Errand.cancel()` methods.
   - Emit events: `ErrandCreated`, `ErrandAssigned`, `ErrandCompleted`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: **MEDIUM-HIGH** (core domain, large codebase, 14 resolvers depend on ErrandsService).

5. **No backfill scripts needed** (all schema changes are additive).

**Risk revised from HIGH to MEDIUM-HIGH**: Schema analysis shows most changes are low-risk (indexes, cascade rules). Main risk is code refactoring due to large surface area (14 resolvers, 1100+ line service).

**Mitigation**: Incremental refactoring (introduce repository pattern PARALLEL to existing service, migrate resolvers one-by-one, remove old service last).

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
class Errand {
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
    public readonly id: string,
    public readonly clientId: string,
    public readonly providerId: string | null,
    public readonly serviceId: string,
    private title: string,
    private description: string,
    private status: ErrandStatus,
    public readonly sourceType: ErrandSourceType,
    private location: Location,
    private pricing: Pricing,
    private readonly attachments: ErrandAttachment[],
    private assignedTo: string | null,
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
    clientId: string,
    serviceId: string,
    title: string,
    description: string,
    sourceType: ErrandSourceType,
    providerId?: string,
  ): Errand;

  /**\n   * Updates errand details (title, description, location, pricing, dates).\n   * Can only update DRAFT errands freely. OPEN errands have restrictions.\n   * @param updates Partial errand updates\n   * @throws InvalidStatusForUpdateError when trying to update non-DRAFT/OPEN errand\n   * @emits ErrandUpdatedEvent\n   */\n  update(updates: Partial<ErrandUpdates>): void;\n\n  /**\n   * Publishes errand (DRAFT → OPEN).\n   * Requires location and pricing to be complete.\n   * @throws IncompleteErrandError when location or pricing missing\n   * @throws InvalidStatusTransitionError when status is not DRAFT\n   * @emits ErrandPublishedEvent\n   */\n  publish(): void;\n\n  /**\n   * Assigns worker to errand (OPEN → ASSIGNED).\n   * Called when application is accepted.\n   * @param workerId Worker ID being assigned\n   * @throws InvalidStatusTransitionError when status is not OPEN\n   * @throws WorkerAlreadyAssignedError when errand already has assignedTo\n   * @emits ErrandAssignedEvent\n   */\n  assignWorker(workerId: string): void;\n\n  /**\n   * Starts errand work (ASSIGNED → IN_PROGRESS).\n   * Worker indicates they've started the job.\n   * @throws InvalidStatusTransitionError when status is not ASSIGNED\n   * @emits ErrandStartedEvent\n   */\n  start(): void;\n\n  /**\n   * Marks errand as complete (IN_PROGRESS → COMPLETED).\n   * Triggers escrow release.\n   * @throws InvalidStatusTransitionError when status is not IN_PROGRESS\n   * @emits ErrandCompletedEvent\n   */\n  complete(): void;\n\n  /**\n   * Cancels errand (any status → CANCELLED).\n   * Can be cancelled by client before IN_PROGRESS.\n   * @param reason Optional cancellation reason\n   * @throws CannotCancelCompletedErrandError when status is COMPLETED\n   * @emits ErrandCancelledEvent\n   */\n  cancel(reason?: string): void;\n\n  /**\n   * Checks if errand can receive applications.\n   * Only OPEN errands with sourceType != DIRECT/RECURRING_CONTRACT/LISTING_HIRE.\n   */\n  canAcceptApplications(): boolean;\n\n  /**\n   * Adds attachment (image/document).\n   * @param url Attachment URL (Firebase Storage)\n   * @param type Attachment type (IMAGE, DOCUMENT)\n   */\n  addAttachment(url: string, type: AttachmentType): void;\n\n  /**\n   * Returns current status.\n   */\n  getStatus(): ErrandStatus;\n\n  /**\n   * Returns location.\n   */\n  getLocation(): Location;\n\n  /**\n   * Returns pricing.\n   */\n  getPricing(): Pricing;\n}\n\n/**\n * Location value object encapsulating geospatial data and address.\n * Immutable - all updates return new Location instances.\n */\nclass Location {\n  /**\n   * @param geoPoint GeoJSON point (from schema: location Json with type/coordinates)\n   * @param address Human-readable address (from schema: serviceAddress String)\n   * @param placeId Optional Google Places ID for validation\n   * @throws InvalidLocationError when geoPoint coordinates are invalid\n   */\n  constructor(\n    public readonly geoPoint: GeoPoint,\n    public readonly address: string,\n    public readonly placeId?: string,\n  );\n\n  /**\n   * Calculates distance to another location in kilometers.\n   * Uses haversine formula.\n   * @param other Target location\n   * @returns Distance in kilometers\n   */\n  distanceTo(other: Location): number;\n\n  /**\n   * Checks if location is within radius of another location.\n   * @param center Center location\n   * @param radiusKm Radius in kilometers\n   */\n  isWithinRadius(center: Location, radiusKm: number): boolean;\n\n  /**\n   * Returns MongoDB GeoJSON representation for $geoNear queries.\n   */\n  toGeoJSON(): { type: 'Point'; coordinates: [number, number] };\n}\n\n/**\n * GeoJSON Point structure.\n */\ninterface GeoPoint {\n  type: 'Point';\n  coordinates: [number, number]; // [longitude, latitude]\n}\n\n/**\n * Pricing value object encapsulating all cost components.\n * Immutable.\n */\nclass Pricing {\n  /**\n   * @param price Fixed price in kobo (from schema: price Int?)\n   * @param hourlyRate Hourly rate in kobo (from schema: hourlyRate Int?)\n   * @param transportAllowance Transport cost in kobo (from schema: transportAllowance Int?)\n   * @param materialsBudget Materials budget in kobo (from schema: materialsBudget Int?)\n   * @throws IncompletePricingError when both price and hourlyRate are null\n   */\n  constructor(\n    public readonly price: number | null,\n    public readonly hourlyRate: number | null,\n    public readonly transportAllowance: number,\n    public readonly materialsBudget: number,\n  );\n\n  /**\n   * Calculates total estimated cost.\n   * If hourlyRate is set, assumes minimum 1 hour.\n   * @returns Total cost in kobo (price/hourlyRate + transport + materials)\n   */\n  calculateTotal(): number;\n\n  /**\n   * Checks if pricing is complete (has price OR hourlyRate).\n   */\n  isComplete(): boolean;\n\n  /**\n   * Formats as Naira string (e.g., \"₦1,500.00\").\n   */\n  toNairaString(): string;\n}\n\n/**\n * Errand attachment entity (child of Errand).\n * Immutable once created.\n */\nclass ErrandAttachment {\n  constructor(\n    public readonly id: string,\n    public readonly errandId: string,\n    public readonly url: string,\n    public readonly type: AttachmentType,\n    public readonly createdAt: Date,\n  );\n}\n\ninterface ErrandUpdates {\n  title?: string;\n  description?: string;\n  location?: Location;\n  pricing?: Pricing;\n  startDate?: Date;\n  endDate?: Date;\n}\n\n/** Thrown when trying to publish errand without complete location/pricing. */\nclass IncompleteErrandError extends Error {}\n\n/** Thrown when invalid status transition attempted. */\nclass InvalidStatusTransitionError extends Error {}\n\n/** Thrown when trying to cancel completed errand. */\nclass CannotCancelCompletedErrandError extends Error {}\n\n/** Thrown when trying to update errand in invalid status. */\nclass InvalidStatusForUpdateError extends Error {}\n\n/** Thrown when worker already assigned. */\nclass WorkerAlreadyAssignedError extends Error {}\n\n/** Thrown when location coordinates invalid. */\nclass InvalidLocationError extends Error {}\n\n/** Thrown when pricing incomplete. */\nclass IncompletePricingError extends Error {}\n```\n\n### Repository Interface\n\n```typescript\n/**\n * Persistence contract for Errand aggregate.\n */\ninterface IErrandRepository {\n  /**\n   * Finds errand by unique ID.\n   * @param id Errand ID\n   * @returns Errand aggregate or null if not found\n   */\n  findById(id: string): Promise<Errand | null>;\n\n  /**\n   * Finds all errands posted by client.\n   * @param clientId Client ID\n   * @param status Optional filter by status\n   * @returns Array of Errand aggregates\n   */\n  findByClient(\n    clientId: string,\n    status?: ErrandStatus,\n  ): Promise<Errand[]>;\n\n  /**\n   * Finds errands assigned to worker.\n   * @param workerId Worker ID\n   * @param status Optional filter by status\n   * @returns Array of Errand aggregates\n   */\n  findByWorker(\n    workerId: string,\n    status?: ErrandStatus,\n  ): Promise<Errand[]>;\n\n  /**\n   * Geospatial query: Find errands near location.\n   * Uses MongoDB $geoNear aggregation.\n   * @param location Center point\n   * @param radiusKm Search radius in kilometers\n   * @param filters Optional filters (status, serviceId, etc.)\n   * @param limit Max results\n   * @returns Errands sorted by distance (nearest first)\n   */\n  findNearby(\n    location: Location,\n    radiusKm: number,\n    filters?: ErrandQueryFilters,\n    limit?: number,\n  ): Promise<Array<{ errand: Errand; distanceKm: number }>>;\n\n  /**\n   * Personalized feed query for worker.\n   * Combines geospatial proximity + skill matching + priority scoring.\n   * @param workerId Worker ID\n   * @param location Worker's location\n   * @param limit Max results\n   * @returns Prioritized errands with match score\n   */\n  findFeedErrands(\n    workerId: string,\n    location: Location,\n    limit?: number,\n  ): Promise<Array<{ errand: Errand; matchScore: number }>>;\n\n  /**\n   * Persists errand aggregate.\n   * @param errand Errand to save\n   */\n  save(errand: Errand): Promise<void>;\n\n  /**\n   * Deletes errand (soft delete - sets deletedAt).\n   * @param id Errand ID\n   */\n  delete(id: string): Promise<void>;\n}\n\ninterface ErrandQueryFilters {\n  status?: ErrandStatus;\n  serviceId?: string;\n  sourceType?: ErrandSourceType;\n  minPrice?: number; // kobo\n  maxPrice?: number; // kobo\n}\n```\n\n### Application Layer\n\n```typescript\n/**\n * Creates new errand in DRAFT status.\n */\nclass CreateErrandCommandHandler {\n  /**\n   * @param command Errand creation details\n   * @throws ClientNotFoundException when client doesn't exist\n   * @throws InvalidServiceIdError when service doesn't exist\n   * @emits ErrandCreatedEvent\n   * @returns Errand ID\n   */\n  execute(command: CreateErrandCommand): Promise<string>;\n}\n\ninterface CreateErrandCommand {\n  clientId: string;\n  serviceId: string;\n  title: string;\n  description: string;\n  sourceType: ErrandSourceType;\n  providerId?: string; // for DIRECT errands\n  location?: { address: string; coordinates: [number, number] };\n  pricing?: { price?: number; hourlyRate?: number; transportAllowance?: number; materialsBudget?: number };\n  startDate?: Date;\n  endDate?: Date;\n}\n\n/**\n * Updates errand details.\n */\nclass UpdateErrandCommandHandler {\n  /**\n   * @param command Update details\n   * @throws ErrandNotFoundException when errand doesn't exist\n   * @throws UnauthorizedException when updatedBy is not errand client\n   * @throws InvalidStatusForUpdateError when errand status doesn't allow updates\n   * @emits ErrandUpdatedEvent\n   */\n  execute(command: UpdateErrandCommand): Promise<void>;\n}\n\ninterface UpdateErrandCommand {\n  errandId: string;\n  updatedBy: string; // must match errand.clientId\n  updates: Partial<ErrandUpdates>;\n}\n\n/**\n * Publishes errand (DRAFT → OPEN).\n */\nclass PublishErrandCommandHandler {\n  /**\n   * @param command Publication details\n   * @throws ErrandNotFoundException when errand doesn't exist\n   * @throws UnauthorizedException when publishedBy is not errand client\n   * @throws IncompleteErrandError when location or pricing incomplete\n   * @throws InvalidStatusTransitionError when status is not DRAFT\n   * @emits ErrandPublishedEvent\n   */\n  execute(command: PublishErrandCommand): Promise<void>;\n}\n\ninterface PublishErrandCommand {\n  errandId: string;\n  publishedBy: string; // client ID\n}\n\n/**\n * Assigns worker to errand (called by AcceptApplicationSaga).\n */\nclass AssignWorkerCommandHandler {\n  /**\n   * @param command Assignment details\n   * @throws ErrandNotFoundException when errand doesn't exist\n   * @throws InvalidStatusTransitionError when status is not OPEN\n   * @throws WorkerAlreadyAssignedError when errand already assigned\n   * @emits ErrandAssignedEvent\n   */\n  execute(command: AssignWorkerCommand): Promise<void>;\n}\n\ninterface AssignWorkerCommand {\n  errandId: string;\n  workerId: string;\n}\n\n/**\n * Starts errand work (ASSIGNED → IN_PROGRESS).\n */\nclass StartErrandCommandHandler {\n  /**\n   * @param command Start details\n   * @throws ErrandNotFoundException when errand doesn't exist\n   * @throws UnauthorizedException when startedBy is not assigned worker\n   * @throws InvalidStatusTransitionError when status is not ASSIGNED\n   * @emits ErrandStartedEvent\n   */\n  execute(command: StartErrandCommand): Promise<void>;\n}\n\ninterface StartErrandCommand {\n  errandId: string;\n  startedBy: string; // worker ID\n}\n\n/**\n * Completes errand (IN_PROGRESS → COMPLETED).\n */\nclass CompleteErrandCommandHandler {\n  /**\n   * @param command Completion details\n   * @throws ErrandNotFoundException when errand doesn't exist\n   * @throws UnauthorizedException when completedBy is not client or worker\n   * @throws InvalidStatusTransitionError when status is not IN_PROGRESS\n   * @emits ErrandCompletedEvent (triggers escrow release)\n   */\n  execute(command: CompleteErrandCommand): Promise<void>;\n}\n\ninterface CompleteErrandCommand {\n  errandId: string;\n  completedBy: string; // client or worker ID\n}\n\n/**\n * Cancels errand.\n */\nclass CancelErrandCommandHandler {\n  /**\n   * @param command Cancellation details\n   * @throws ErrandNotFoundException when errand doesn't exist\n   * @throws UnauthorizedException when cancelledBy is not client\n   * @throws CannotCancelCompletedErrandError when status is COMPLETED\n   * @emits ErrandCancelledEvent (triggers escrow refund if status was IN_PROGRESS)\n   */\n  execute(command: CancelErrandCommand): Promise<void>;\n}\n\ninterface CancelErrandCommand {\n  errandId: string;\n  cancelledBy: string; // client ID\n  reason?: string;\n}\n\n/**\n * Query handler: Get personalized feed of errands for worker.\n * Uses geospatial + skill matching.\n */\nclass GetFeedErrandsQueryHandler {\n  /**\n   * @param query Worker ID and location\n   * @returns Prioritized errands sorted by match score\n   */\n  execute(query: GetFeedErrandsQuery): Promise<ErrandFeedDTO[]>;\n}\n\ninterface GetFeedErrandsQuery {\n  workerId: string;\n  location: { coordinates: [number, number] };\n  radiusKm: number;\n  limit: number;\n}\n\n/**\n * Query handler: Get errand by ID.\n */\nclass GetErrandQueryHandler {\n  /**\n   * @param query Errand ID\n   * @returns Errand details\n   * @throws ErrandNotFoundException when not found\n   */\n  execute(query: GetErrandQuery): Promise<ErrandDTO>;\n}\n\ninterface GetErrandQuery {\n  errandId: string;\n}\n\ninterface ErrandDTO {\n  id: string;\n  clientId: string;\n  serviceId: string;\n  title: string;\n  description: string;\n  status: ErrandStatus;\n  sourceType: ErrandSourceType;\n  location: { address: string; coordinates: [number, number] };\n  pricing: { price?: number; hourlyRate?: number; transportAllowance: number; materialsBudget: number; total: number };\n  assignedTo: string | null;\n  startDate: Date | null;\n  endDate: Date | null;\n  createdAt: Date;\n  updatedAt: Date;\n}\n\ninterface ErrandFeedDTO extends ErrandDTO {\n  distanceKm: number;\n  matchScore: number; // 0-100 based on skills, distance, etc.\n}\n```\n\n### Domain Events\n\n```typescript\n/**\n * Emitted when new errand created.\n * Consumed by: Notification (notify nearby workers), Search indexer\n */\nclass ErrandCreatedEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly clientId: string,\n    public readonly serviceId: string,\n    public readonly location: Location,\n  ) {}\n}\n\n/**\n * Emitted when errand published (DRAFT → OPEN).\n * Consumed by: Notification (notify nearby workers), Recommendation engine\n */\nclass ErrandPublishedEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly clientId: string,\n    public readonly location: Location,\n    public readonly pricing: Pricing,\n  ) {}\n}\n\n/**\n * Emitted when errand updated.\n * Consumed by: Search re-indexer\n */\nclass ErrandUpdatedEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly updates: Partial<ErrandUpdates>,\n  ) {}\n}\n\n/**\n * Emitted when worker assigned to errand.\n * Consumed by: Escrow (create escrow), Notification, Application (reject other applications)\n */\nclass ErrandAssignedEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly clientId: string,\n    public readonly workerId: string,\n  ) {}\n}\n\n/**\n * Emitted when errand work starts.\n * Consumed by: Notification\n */\nclass ErrandStartedEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly workerId: string,\n  ) {}\n}\n\n/**\n * Emitted when errand completed.\n * CRITICAL: Triggers escrow release.\n * Consumed by: Escrow (release funds), Rating (prompt rating), Notification\n */\nclass ErrandCompletedEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly clientId: string,\n    public readonly workerId: string,\n  ) {}\n}\n\n/**\n * Emitted when errand cancelled.\n * Consumed by: Escrow (refund if status was IN_PROGRESS), Application (cancel applications), Notification\n */\nclass ErrandCancelledEvent {\n  constructor(\n    public readonly errandId: string,\n    public readonly clientId: string,\n    public readonly reason: string | null,\n  ) {}\n}\n```\n\n### Event Handlers (React to other module events)\n\n```typescript\n/**\n * Listens to ApplicationAcceptedEvent and assigns worker to errand.\n * Part of AcceptApplicationSaga.\n */\nclass OnApplicationAcceptedAssignWorkerHandler {\n  /**\n   * @listens ApplicationAcceptedEvent\n   * Calls AssignWorkerCommandHandler\n   */\n  handle(event: ApplicationAcceptedEvent): Promise<void>;\n}\n```
````

### Repository Interface

```typescript
/**
 * Persistence contract for Errand aggregate.
 */
interface IErrandRepository {
  /**
   * Finds errand by Errand.id.
   */
  findById(id: string): Promise<Errand | null>;

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
  findByClientId(clientId: string): Promise<Errand[]>;

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
  execute(command: CreateErrandCommand): Promise<string>;
}

interface CreateErrandCommand {
  clientId: string;
  serviceId: string;
  title: string;
  description: string;
  sourceType: ErrandSourceType;
  providerId?: string;
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
  errandId: string;
  publishedBy: string;
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
  errandId: string;
  workerId: string;
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
  errandId: string;
  completedBy: string;
}
```

### Domain Events

```typescript
/**
 * Emitted when errand draft is created.
 */
class ErrandCreatedEvent {
  constructor(
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly serviceId: string,
  );
}

/**
 * Emitted when errand is published.
 */
class ErrandPublishedEvent {
  constructor(
    public readonly errandId: string,
    public readonly clientId: string,
  );
}

/**
 * Emitted when worker assignment succeeds.
 */
class ErrandAssignedEvent {
  constructor(
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly workerId: string,
  );
}

/**
 * Emitted when errand completion succeeds.
 */
class ErrandCompletedEvent {
  constructor(
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly workerId: string,
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
