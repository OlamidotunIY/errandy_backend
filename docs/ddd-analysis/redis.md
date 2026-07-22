# Redis — DDD & EIP Analysis

## 1. Current Responsibility

Provides Redis client configuration:

- **Module file only**: `redis.module.ts` exports Redis client (ioredis instance).
- Used by: Presence, PubSub, (future: caching, rate limiting, session storage).

**Files**: `redis.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure configuration**, NOT a bounded context.

- Redis is a **technical dependency** (in-memory data store) — no domain logic.
- Redis is used by multiple infrastructure modules (Presence, PubSub).

**Verdict**: Redis is an **infrastructure layer** (configuration module). Should remain as `infrastructure/redis/` or `common/redis/`.

## 3. Domain Model Audit

**No domain model** — Redis is purely infrastructure (configuration).

- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — Redis is correctly positioned as infrastructure.

## 5. Repository Pattern Gap

**Not applicable** — Redis is infrastructure, not domain.

## 6. EIP Opportunities

**Caching**:

- Redis is ideal for caching (service catalog, user sessions, query results).
- Recommendation: Add caching layer for:
  - Service catalog (TTL: 1 hour).
  - Provider ratings (TTL: 5 minutes).
  - Errand search results (TTL: 1 minute).

**Rate Limiting**:

- Redis can track API rate limits (e.g., 100 requests/minute per user).
- Recommendation: Add rate limiting middleware using Redis.

**Session Storage**:

- Redis can store user sessions (better than in-memory sessions, which are lost on server restart).

## 7. Cross-Cutting Concerns

**Error handling**:

- If Redis is down, all dependent modules (Presence, PubSub) fail.
- Recommendation: Add health check, graceful degradation (fallback to in-memory for non-critical features).

**Logging**:

- Should log Redis connection status (connected, disconnected, error).

## 8. GraphQL-Specific Notes

**Not applicable** — Redis is infrastructure, not exposed via GraphQL.

## 9. Target Structure

```
src/infrastructure/redis/  # OR src/common/redis/
  redis.module.ts               # Exports Redis client
  redis.service.ts              # Optional: Wrapper for Redis operations (get, set, del, expire)
  cache.service.ts              # Optional: High-level caching abstraction (cache-aside pattern)
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Redis is infrastructure — refactoring won't break domain logic.

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Redis is infrastructure — refactoring doesn't unlock domain modeling.
2. Current implementation is minimal but functional — no urgent changes needed.
3. Caching/rate limiting can be added incrementally (after core refactoring).

**Migration steps**:

1. **Add health check** (monitor Redis connection status).
2. **Add caching layer** (Service catalog, Provider ratings, Errand search).
3. **Add rate limiting** (API requests per user/IP).
4. **Add logging** (Redis connection events).
