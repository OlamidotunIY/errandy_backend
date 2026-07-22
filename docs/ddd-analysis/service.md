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
