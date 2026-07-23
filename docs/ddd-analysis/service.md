# Service — DDD & EIP Analysis

## 1. Current Responsibility

Manages service catalog (skills taxonomy):

- **Get service by ID**: `findOne` (line 9-16) fetches a service with its category.
- **Get service categories**: `getServiceCategories` (line 18-32) fetches categories with nested services, optionally filtered by type.
- **Get services**: `getServices` (line 34-46) fetches all services with categories, optionally filtered by category type.

**Files**: `service.service.ts` (~46 lines), `service.resolver.ts`, `service.module.ts`.

## 2. Bounded Context Assessment

**This is a shared kernel** for "Service Catalog" (skills taxonomy).

- Service is a **reference data** module — it defines the vocabulary of skills/services in the marketplace.
- Service is used by:
  - **Provider**: Providers have skills (`ProviderService` join table links providers to services).
  - **Errands**: Errands require services (`errand.serviceId` or similar).

**Verdict**: Service is a **shared kernel** (core domain vocabulary) — keep as separate bounded context. All modules depend on it for skill taxonomy.

## 3. Domain Model Audit

**Anemic models** (but acceptable for reference data):

- `Service` (Prisma model) is a data bag with `name`, `description`, `categoryId`.
  - No behavior needed — services are read-only reference data (catalog).
- `ServiceCategory` (Prisma model) is a data bag with `name`, `type` (likely ERRAND | PROFESSIONAL | OTHER).
  - No behavior needed.

**Aggregate boundaries**:

- **`ServiceCategory`** is the aggregate root, owning:
  - `Service` (child entity — services belong to categories).
- However, for read-only catalogs, aggregates are less important (no invariants to enforce).

**Invariants (if Service had behavior)**:

1. **Uniqueness**: Service names should be unique within a category.
2. **Active/Inactive**: Services should have `isActive` flag (deactivated services hidden from provider profile, but existing providers keep them).

## 4. Layering Violations

**None** — Service module is purely read operations (queries).

- Service creation/updates likely happen via admin panel or seed scripts (not in application code).

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage (acceptable for simple read-only catalogs).

**Proposed** (if Service grows complex):

```
domain/
  IServiceRepository (interface)
    - findById(id): Service | null
    - findByCategory(categoryId): Service[]
    - findAll(): Service[]
infrastructure/
  PrismaServiceRepository (implementation)
```

## 6. EIP Opportunities

**Content-Based Router**:

- `getServiceCategories` (line 18-32) filters by type (ERRAND | PROFESSIONAL) — simple content-based routing.

**Cache-Aside**:

- Service catalog is **static reference data** — should be cached in Redis (TTL: 1 hour).
- Current: Queries Prisma on every request — inefficient.
- Recommendation: Cache service categories in Redis, invalidate on admin updates.

**Dead Letter / Retry**:

- No external calls (all DB queries).

## 7. Cross-Cutting Concerns

**Caching**:

- Service catalog should be cached (Redis) — currently not cached.

**Validation**:

- No validation needed (read-only queries).

## 8. GraphQL-Specific Notes

**DataLoader**:

- If client code queries `providers { services { category } }`, potential N+1 for categories — use DataLoader.

**Authorization**:

- Service catalog is public (no auth needed).

## 9. Target Structure

```
src/service/
  domain/
    entities/
      ServiceCategory.ts            # Aggregate root (read-only)
      Service.ts                    # Child entity (read-only)
    repositories/
      IServiceRepository.ts

  application/
    queries/
      GetServiceCategories/
        GetServiceCategoriesQuery.ts
        GetServiceCategoriesHandler.ts
      GetServices/
        GetServicesQuery.ts
        GetServicesHandler.ts

  infrastructure/
    repositories/
      PrismaServiceRepository.ts
    cache/
      ServiceCacheService.ts        # Redis cache for service catalog

  presentation/
    resolvers/
      ServiceResolver.ts
```

## Persistence Model (Derived from Domain)

```prisma
model ServiceCategory {
  id String @id @map("_id")
  name String
  type ServiceCategoryType

  @@index([type]) // serves: findAllCategories grouping/filtering
}

model Service {
  id String @id @map("_id")
  categoryId String
  name String
  type ServiceCategoryType

  @@index([categoryId]) // serves: findServicesByCategoryId
}
```

`ServiceCategoryAggregate` is the aggregate root for catalog grouping; `Service` is a catalog child reachable only through `IServiceRepository`. References are scalar IDs only: `categoryId`. Cleanup owner: `ServiceCatalogAdminHandler` updates categories and services through `IServiceRepository`; Errand cleanup is handled by `ServiceRetiredHandler` in the Errands module before any service is removed. `ServiceCategory.id` serves `findAllCategories`, `Service.id` serves `findServiceById`, and `categoryId` serves `findServicesByCategoryId`.

---

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Service is read-only catalog — refactoring won't break writes (no writes).
- All modules depend on Service, but only for reads (low coupling).

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Service is infrastructure/reference data — refactoring doesn't unlock domain modeling.
2. Caching service catalog (Redis) can be done independently of domain refactoring.
3. Current implementation is simple and works — low urgency.

**Migration steps**:

1. **Cache service catalog in Redis** (TTL: 1 hour).
2. **Add DataLoader** for service categories (prevent N+1).
3. **Add `isActive` flag** to Service model (soft delete for deprecated services).
4. **Introduce IServiceRepository** if Service grows complex (admin panel for managing catalog).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Service catalog category aggregate (read-centric).
 * Maps to ServiceCategory fields: id, name, type.
 */
class ServiceCategoryId extends EntityId {
  /**
   * Private constructor. Use ServiceCategoryId.new() or ServiceCategoryId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new ServiceCategoryId.
   */
  static new(): ServiceCategoryId;

  /**
   * Rehydrates ServiceCategoryId from persisted value.
   */
  static from(value: string): ServiceCategoryId;
}

/**
 * Service identifier used for catalog entries.
 */
class ServiceId extends EntityId {
  /**
   * Private constructor. Use ServiceId.new() or ServiceId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new ServiceId.
   */
  static new(): ServiceId;

  /**
   * Rehydrates ServiceId from persisted value.
   */
  static from(value: string): ServiceId;
}

/**
 * Service catalog category aggregate (read-centric).
 */
class ServiceCategoryAggregate extends AggregateRoot<ServiceCategoryId> {
  constructor(
    public readonly id: ServiceCategoryId,
    public readonly name: string,
    public readonly type: ServiceCategoryType,
    public readonly services: ServiceAggregate[],
  );

  /**
   * Creates a new service category aggregate.
   */
  static create(
    name: string,
    type: ServiceCategoryType,
    services?: ServiceAggregate[],
  ): ServiceCategoryAggregate;

  /**
   * Reconstitutes service category aggregate from persistence.
   */
  static reconstitute(
    id: ServiceCategoryId,
    name: string,
    type: ServiceCategoryType,
    services: ServiceAggregate[],
  ): ServiceCategoryAggregate;
}

/**
 * Service entry mapped from Service model fields: id, name, type, categoryId.
 */
class ServiceAggregate {
  constructor(
    public readonly id: ServiceId,
    public readonly name: string,
    public readonly type: ServiceCategoryType,
    public readonly categoryId: ServiceCategoryId,
  );
}
```

### Repository Interface

```typescript
/**
 * Read contract for service catalog and category listing.
 */
interface IServiceRepository {
  /**
   * Returns all categories with child services.
   */
  findAllCategories(): Promise<ServiceCategoryAggregate[]>;

  /**
   * Returns services by Service.categoryId.
   */
  findServicesByCategoryId(
    categoryId: ServiceCategoryId,
  ): Promise<ServiceAggregate[]>;

  /**
   * Returns service by Service.id.
   */
  findServiceById(id: ServiceId): Promise<ServiceAggregate | null>;
}
```

### Application Layer

```typescript
/**
 * Query handler for full service category listing.
 */
class GetServiceCategoriesQueryHandler {
  /**
   * Reads and returns all ServiceCategory records.
   */
  execute(): Promise<ServiceCategoryAggregate[]>;
}

/**
 * Query handler for services under one category.
 */
class GetServicesByCategoryQueryHandler {
  /**
   * Reads Service records filtered by categoryId.
   */
  execute(query: GetServicesByCategoryQuery): Promise<ServiceAggregate[]>;
}

interface GetServicesByCategoryQuery {
  categoryId: ServiceCategoryId;
}
```

### Domain Events

```typescript
/**
 * Emitted when service catalog cache is refreshed.
 */
class ServiceCatalogRefreshedEvent {
  constructor(
    public readonly categoryCount: number,
    public readonly serviceCount: number,
  );
}
```
