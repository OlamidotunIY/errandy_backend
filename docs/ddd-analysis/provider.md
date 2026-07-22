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
