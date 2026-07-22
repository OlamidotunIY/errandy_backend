# Presence — DDD & EIP Analysis

## 1. Current Responsibility

Tracks user online/offline status via Redis:

- **Add connection**: `addConnection` (line 18-26) adds WebSocket connection ID to user's connection set.
- **Remove connection**: `removeConnection` (line 28-34) removes connection ID when user disconnects.
- **Check online status**: `isOnline` (line 36-39) checks if user has active connections (count > 0).
- **Last seen timestamp**: `setLastSeen` (line 41-47), `getLastSeen` (line 49-51) track when user was last active.

**Files**: `presence.service.ts` (~51 lines), `presence.publisher.ts`, `presence.resolver.ts`, `presence.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Presence is a **cross-cutting concern** for real-time features (chat, notifications).
- Presence has NO domain logic — it's a facade over Redis sets (connection tracking).

**Overlaps**:

- **Chat**: Chat UI shows "user is typing" or "user is online" (queries Presence).
- **Notification**: Notification can skip push if user is online (query Presence to avoid redundant notifications).

**Verdict**: Presence is an **infrastructure layer** (real-time state management). Should be in `infrastructure/presence/` or `common/presence/`.

## 3. Domain Model Audit

**No domain model** — Presence is purely infrastructure (Redis key-value operations).

- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — Presence is correctly positioned as infrastructure.

## 5. Repository Pattern Gap

**Not applicable** — Presence uses Redis (in-memory data), not domain entities.

## 6. EIP Opportunities

**Publish-Subscribe**:

- `presence.publisher.ts` (not shown) likely publishes online/offline events to PubSub.
- GraphQL subscriptions can listen to `userPresenceChanged:${userId}` (real-time online status updates).

**TTL / Cleanup**:

- `addConnection` (line 24) sets TTL of 1 hour on connection set — good (prevents stale connections).
- `setLastSeen` (line 47) sets TTL of 30 days — good (cleanup old data).

## 7. Cross-Cutting Concerns

**Error handling**:

- No error handling (assumes Redis is always available) — if Redis is down, presence checks fail silently.

**Logging**:

- No logging (should log connection/disconnection for debugging WebSocket issues).

## 8. GraphQL-Specific Notes

**WebSocket lifecycle**:

- `addConnection` is called when GraphQL WebSocket connects (subscription starts).
- `removeConnection` is called when WebSocket disconnects.
- Presence service bridges GraphQL WebSocket lifecycle with Redis state.

## 9. Target Structure

```
src/infrastructure/presence/  # OR src/common/presence/
  PresenceService.ts            # Tracks online/offline status via Redis
  PresencePublisher.ts          # Publishes presence events to PubSub (GraphQL subscriptions)

  presentation/
    PresenceResolver.ts         # GraphQL queries: isOnline, getLastSeen
                                # GraphQL subscriptions: userPresenceChanged
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Presence is infrastructure — refactoring won't break domain logic.
- Current implementation is simple and works (no critical bugs).

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Presence is infrastructure — refactoring doesn't unlock domain modeling.
2. Current implementation is functional — no urgent changes needed.
3. Presence is used by Chat (real-time typing indicators) — refactor after Chat is refactored.

**Migration steps**:

1. **Add logging** (connection/disconnection events for debugging).
2. **Add error handling** (fallback if Redis is down — assume user offline).
3. **Add presence cleanup** (scheduled job to remove stale connections).
4. **Optimize TTL** (tune connection set TTL based on WebSocket ping/pong intervals).
