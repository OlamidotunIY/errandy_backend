# Provider — DDD & EIP Analysis

## 1. Current Responsibility

Manages provider (worker) discovery and profile enrichment:

- Provider discovery feeds: `getProviders` returns trusted, new, popular, and suggested providers for a client.
- Provider enrichment: Maps provider data with services, active address, and ratings (calls `RatingService`).
- Provider search: Filters by skills, location, etc. (likely in `searchProviders` method, not seen in excerpt).

**Files**: `provider.service.ts` (~150 lines seen), `provider.resolver.ts`, `provider.module.ts`.

## 2. Bounded Context Assessment

**This should be part of the "Worker Identity & Discovery" bounded context**, related to Users.

- Provider is a **role-specific profile** — a User can have a Provider profile if they're a worker.
- Provider profile extends User with worker-specific data: skills (`services`), ratings, availability, providerType (INDIVIDUAL | ORGANIZATION).

**Overlaps**:

- **Users**: Provider has a `userId` foreign key — tightly coupled to User aggregate.
- **Organization**: Providers can be members of organizations (`Organization` has `members: OrgMember[]`), but organization logic is separate.
- **Service**: Providers have skills (`services: ProviderService[]` join table), but Service module owns skill catalog.
- **Rating**: Provider discovery calls `RatingService.getProviderRatings` (line 30) — data aggregation, not domain logic.

**Verdict**: Provider is a **sub-domain of Users** or a separate "Worker Management" bounded context. It's currently split awkwardly across Users (profile) and Provider (discovery).

## 3. Domain Model Audit

**Anemic models**:

- `Provider` (Prisma model) is a data bag with `userId`, `providerType`, `services`, `bio`.
- No domain behavior:
  - No `Provider.updateSkills()` method.
  - No `Provider.acceptErrand()` method (assignment logic is in Escrow/Application modules).
  - No `Provider.calculateRanking()` method (popularity is computed in ProviderService, line 100+).

**Aggregate boundaries**:

- **Option 1: Provider as part of User aggregate**:
  - `User` aggregate owns `Provider` as a child entity (like `Client`).
  - Benefits: Keeps all user identity data in one place.

- **Option 2: Provider as separate aggregate**:
  - `Provider` is its own aggregate root with `userId` as a value object reference.
  - Benefits: Decouples worker-specific logic from generic user profile.

**Recommendation**: Option 2 (separate aggregate) if provider domain grows complex (scheduling, certifications, background checks). Otherwise, merge into User.

**Invariants currently unenforced**:

1. **Skill validation**:
   - Providers can have any `services` (join table with Service), but no validation that skills are active/valid.
2. **Provider type constraints**:
   - If `providerType === ORGANIZATION`, provider must be linked to an Organization record — not enforced.
3. **Ranking/popularity**:
   - Popularity is calculated ad-hoc in service (line 100+: count of completed errands) — should be cached/denormalized for performance.

## 4. Layering Violations

**Business logic in service**:

- `enrichProviders` (line 27-56) is data transformation logic (mapping Prisma includes to GraphQL types) — this is a **DTO mapper**, not business logic, but lives in service.
- Popularity calculation (line 100+): Groups errands by `assignedTo`, counts completed errands — this is a read model query, should be in CQRS query handler.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.provider.*`, `this.prisma.errand.groupBy`).
- No repository abstraction.

**Cross-module data access**:

- `getProviders` (line 66+) queries `TrustedCircleMember`, `Errand`, `Provider` — crosses multiple aggregates without domain boundaries.
- This is a read model / query service, which is fine, but should be explicit (separate from command/domain services).

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IProviderRepository (interface)
    - findById(id): Provider | null
    - findByUserId(userId): Provider | null
    - findNewProviders(limit): Provider[]
    - save(provider): void
infrastructure/
  PrismaProviderRepository (implementation)

  queries/
    ProviderDiscoveryQueryService (read model)
      - getProvidersByTrust(clientId): Provider[]
      - getPopularProviders(): Provider[]
      - getSuggestedProviders(clientId): Provider[]
```

**Consolidation**: Write operations (create/update provider) use repository. Read operations (discovery, search) use query service.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **ProviderProfileUpdated event**:
   - When provider updates skills, bio, or profile, emit event.
   - Listeners:
     - Recommendation engine reindexes provider.
     - Notification sends "profile verified" message if bio passes moderation.

2. **ProviderRatingChanged event**:
   - When a new rating is submitted, emit event.
   - Listeners:
     - Provider service updates cached average rating (denormalized field).
     - Notification sends "new 5-star review" alert.

**Aggregator**:

- `getProviders` (line 66-150) aggregates data from multiple sources:
  - Trusted providers (from TrustedCircle).
  - New providers (sorted by user.createdAt).
  - Popular providers (grouped by errand completion count).
  - Suggested providers (inferred from client's errand history).

  This is a **legitimate aggregator pattern** for a read model. Should be in a dedicated **ProviderDiscoveryQueryService** to separate reads from writes.

**Content-Based Router**:

- Discovery logic routes providers into different feeds (trusted, new, popular, suggested) based on criteria.
- This is fine as-is, but could be a strategy pattern if feeds become complex (e.g., ML-based recommendations).

**Dead Letter / Retry**:

- No external calls in ProviderService (all DB queries).
- If Prisma query times out, error bubbles up — no retry.

## 7. Cross-Cutting Concerns

**Validation**:

- No validation in ProviderService (assumes data from resolvers is pre-validated via DTOs).

**Transactions**:

- `getProviders` is read-only (no transactions needed).

**Error handling**:

- No error handling in seen excerpt (likely throws Prisma errors directly).

## 8. GraphQL-Specific Notes

**GraphQL types**:

- `Provider` entity includes enriched data: `services`, `activeAddress`, `rating` (line 41-53).
- This is a **DTO transformation** (Prisma model + joined data → GraphQL type).

**N+1 risk**:

- `enrichProviders` (line 27-56) maps provider services from join table (`p.services?.map(s => s.service)`) — already loaded via Prisma include, no N+1.
- `getProviderRatings` (line 30) fetches ratings for ALL providers in one query (batched) — good.
- If client code queries `providers { errands { client } }`, potential N+1 — no DataLoader.

**Authorization**:

- No auth checks in ProviderService — assumes resolver validates user permissions.

## 9. Target Structure

```
src/provider/
  domain/
    entities/
      Provider.ts                   # Aggregate root with updateSkills(), updateBio()
    value-objects/
      ProviderType.ts               # INDIVIDUAL | ORGANIZATION
      SkillSet.ts                   # Collection of services with proficiency levels
    repositories/
      IProviderRepository.ts        # Interface: findById, save
    events/
      ProviderProfileUpdated.ts
      ProviderSkillsChanged.ts

  application/
    commands/
      UpdateProviderProfile/
        UpdateProviderProfileCommand.ts
        UpdateProviderProfileHandler.ts
    queries/
      GetProviders/
        GetProvidersQuery.ts
        GetProvidersHandler.ts      # Discovery logic: trusted, new, popular, suggested
      SearchProviders/
        SearchProvidersQuery.ts
        SearchProvidersHandler.ts

  infrastructure/
    repositories/
      PrismaProviderRepository.ts
    query-services/
      ProviderDiscoveryQueryService.ts  # Read model for provider feeds

  presentation/
    resolvers/
      ProviderResolver.ts
    types/
      ProviderType.ts
      ProviderDiscoveryResponse.ts
```

## 10. Migration Risk & Priority

**Risk**: **MEDIUM**

- Provider is used by Errands (errand assignment), Application (worker applies), and Chat (provider-client messaging).
- Refactoring could break provider discovery feeds (critical for marketplace).

**Priority**: **PHASE 2 (after Escrow/Application)**
**Rationale**:

1. Provider discovery is important but not as critical as payment flows (Escrow/Application).
2. Provider module is mostly read-heavy (queries), which is easier to refactor than write-heavy modules.
3. Refactoring provider enables cleaner integration with Errands (e.g., errand assignment emits event → provider receives notification).

**Migration steps**:

1. **Extract Provider aggregate** with `updateSkills()`, `updateBio()` methods.
2. **Separate read model from write model** (CQRS):
   - Write: `UpdateProviderProfileHandler` uses `IProviderRepository`.
   - Read: `GetProvidersHandler` uses `ProviderDiscoveryQueryService`.
3. **Introduce IProviderRepository** and `PrismaProviderRepository`.
4. **Create query service** for provider discovery (move aggregation logic out of service).
5. **Emit events**: `ProviderProfileUpdated`, `ProviderSkillsChanged`.
6. **Denormalize provider rating** (cache average rating in Provider table, updated via event listener).
7. **Add DataLoader** for provider queries (prevent N+1 if needed).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Provider aggregate root representing a service provider profile.
 * Core invariants:
 * - Provider must have associated User (userId must be valid)
 * - Skills array must not be empty for verified providers
 * - Bio must be set before provider can be discoverable
 * - averageRating is denormalized from Rating table (updated via events)
 * - One provider per user (userId is unique)
 */
class ProviderId extends EntityId {
  /**
   * Private constructor. Use ProviderId.new() or ProviderId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new ProviderId.
   */
  static new(): ProviderId;

  /**
   * Rehydrates ProviderId from persisted value.
   */
  static from(value: string): ProviderId;
}

/**
 * Provider aggregate root representing a service provider profile.
 */
class Provider extends AggregateRoot<ProviderId> {
  /**
   * Private constructor - use Provider.create() factory or load from repository.
   * @param id Unique provider identifier (from schema: id String @id)
   * @param userId Associated user ID (from schema: userId String @unique)
   * @param bio Provider bio/description (from schema: bio String?)
   * @param skills Service skills (from schema: skills String[])
   * @param verified Verification status (from schema: verified Boolean)
   * @param averageRating Denormalized average rating (from schema: averageRating Float?)
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: ProviderId,
    public readonly userId: UserId,
    private bio: string | null,
    private skills: string[],
    private verified: boolean,
    private averageRating: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Factory method to create new provider profile.
   * Provider starts unverified with empty bio and skills.
   * @param userId User ID
   * @throws UserNotFoundException when user doesn't exist
   * @throws ProviderAlreadyExistsError when user already has provider profile
   * @returns New Provider instance
   */
  static create(userId: UserId): Provider;

  /**
   * Reconstitutes Provider aggregate from persistence.
   */
  static reconstitute(
    id: ProviderId,
    userId: UserId,
    bio: string | null,
    skills: string[],
    verified: boolean,
    averageRating: number | null,
    createdAt: Date,
    updatedAt: Date,
  ): Provider;

  /**
   * Updates provider bio.
   * @param bio Bio text (min 50 characters recommended)
   * @emits ProviderProfileUpdatedEvent
   */
  updateBio(bio: string): void;

  /**
   * Updates provider skills.
   * Skills must match predefined skill taxonomy.
   * @param skills Array of skill names
   * @throws InvalidSkillsError when skills array empty or contains unknown skills
   * @emits ProviderSkillsChangedEvent
   */
  updateSkills(skills: string[]): void;

  /**
   * Marks provider as verified.
   * Requires bio and skills to be set.
   * @throws IncompleteProfileError when bio or skills missing
   * @emits ProviderVerifiedEvent
   */
  verify(): void;

  /**
   * Updates denormalized average rating.
   * Called by event handler when new rating received.
   * @param averageRating New average (1.0-5.0)
   */
  updateAverageRating(averageRating: number): void;

  /**
   * Checks if provider profile is complete (has bio and skills).
   */
  isProfileComplete(): boolean;

  /**
   * Checks if provider is discoverable (verified + complete profile).
   */
  isDiscoverable(): boolean;
}

/** Thrown when user already has provider profile. */
class ProviderAlreadyExistsError extends Error {}

/** Thrown when skills array invalid. */
class InvalidSkillsError extends Error {}

/** Thrown when trying to verify incomplete profile. */
class IncompleteProfileError extends Error {}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Provider aggregate.
 */
interface IProviderRepository {
  /**
   * Finds provider by unique ID.
   * @param id Provider ID
   * @returns Provider aggregate or null if not found
   */
  findById(id: ProviderId): Promise<Provider | null>;

  /**
   * Finds provider by user ID.
   * @param userId User ID
   * @returns Provider aggregate or null if not found
   */
  findByUserId(userId: UserId): Promise<Provider | null>;

  /**
   * Finds providers by skills (discovery query).
   * Used for matching providers to errands.
   * @param skills Array of required skills
   * @param verified Only return verified providers
   * @returns Array of Provider aggregates
   */
  findBySkills(skills: string[], verified?: boolean): Promise<Provider[]>;

  /**
   * Persists provider aggregate.
   * @param provider Provider to save
   */
  save(provider: Provider): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Creates new provider profile.
 */
class CreateProviderCommandHandler {
  /**
   * @param command Provider creation details
   * @throws UserNotFoundException when user doesn't exist
   * @throws ProviderAlreadyExistsError when user already has provider profile
   * @emits ProviderCreatedEvent
   * @returns Provider ID
   */
  execute(command: CreateProviderCommand): Promise<ProviderId>;
}

interface CreateProviderCommand {
  userId: UserId;
}

/**
 * Updates provider profile.
 */
class UpdateProviderProfileCommandHandler {
  /**
   * @param command Profile updates
   * @throws ProviderNotFoundException when provider doesn't exist
   * @throws UnauthorizedException when updatedBy is not provider's user
   * @throws InvalidSkillsError when skills invalid
   * @emits ProviderProfileUpdatedEvent
   */
  execute(command: UpdateProviderProfileCommand): Promise<void>;
}

interface UpdateProviderProfileCommand {
  providerId: ProviderId;
  updatedBy: UserId; // user ID (must match provider.userId)
  bio?: string;
  skills?: string[];
}

/**
 * Verifies provider.
 */
class VerifyProviderCommandHandler {
  /**
   * @param command Verification details
   * @throws ProviderNotFoundException when provider doesn't exist
   * @throws IncompleteProfileError when bio or skills missing
   * @emits ProviderVerifiedEvent
   */
  execute(command: VerifyProviderCommand): Promise<void>;
}

interface VerifyProviderCommand {
  providerId: ProviderId;
  verifiedBy: UserId; // admin user ID
}

/**
 * Query handler: Get provider by ID.
 */
class GetProviderQueryHandler {
  /**
   * @param query Provider ID
   * @returns Provider details with user profile
   * @throws ProviderNotFoundException when not found
   */
  execute(query: GetProviderQuery): Promise<ProviderDTO>;
}

interface GetProviderQuery {
  providerId: ProviderId;
}

/**
 * Query handler: Discover providers by skills.
 */
class DiscoverProvidersQueryHandler {
  /**
   * @param query Skills and filters
   * @returns Array of providers sorted by relevance/rating
   */
  execute(query: DiscoverProvidersQuery): Promise<ProviderDTO[]>;
}

interface DiscoverProvidersQuery {
  skills: string[];
  verifiedOnly: boolean;
  limit: number;
}

interface ProviderDTO {
  id: ProviderId;
  userId: UserId;
  bio: string | null;
  skills: string[];
  verified: boolean;
  averageRating: number | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string; image: string | null };
}
```

### Domain Events

```typescript
/**
 * Emitted when new provider profile created.
 * Consumed by: Users module (add PROVIDER role), Notification
 */
class ProviderCreatedEvent {
  constructor(
    public readonly providerId: ProviderId,
    public readonly userId: UserId,
  ) {}
}

/**
 * Emitted when provider profile updated.
 * Consumed by: Search indexer, Notification
 */
class ProviderProfileUpdatedEvent {
  constructor(
    public readonly providerId: ProviderId,
    public readonly updates: { bio?: string; skills?: string[] },
  ) {}
}

/**
 * Emitted when provider skills changed.
 * Consumed by: Recommendation engine (re-match to errands)
 */
class ProviderSkillsChangedEvent {
  constructor(
    public readonly providerId: ProviderId,
    public readonly skills: string[],
  ) {}
}

/**
 * Emitted when provider verified.
 * Consumed by: Notification (notify provider)
 */
class ProviderVerifiedEvent {
  constructor(public readonly providerId: ProviderId) {}
}
```

### Event Handlers (React to other module events)

```typescript
/**
 * Listens to RatingCreatedEvent and updates Provider.averageRating.
 * Denormalization for performance.
 */
class OnRatingCreatedUpdateProviderRatingHandler {
  /**
   * @listens RatingCreatedEvent (when rateeId is provider's userId)
   * Recalculates average rating and updates Provider aggregate
   */
  handle(event: RatingCreatedEvent): Promise<void>;
}
```
