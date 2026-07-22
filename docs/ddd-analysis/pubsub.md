# PubSub — DDD & EIP Analysis

## 1. Current Responsibility

Provides GraphQL subscriptions via Redis Pub/Sub:

- **Publish events**: `publish` (line 34-36) publishes events to Redis Pub/Sub channels.
- **Async iterator**: `asyncIterator` (line 38-40) creates async iterator for GraphQL subscriptions (listens to Redis channels).
- **Redis Pub/Sub wrapper**: Uses `graphql-redis-subscriptions` library (line 24-28).

**Files**: `pubsub.service.ts` (~40 lines), `pubsub.module.ts`, `README.md`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- PubSub is a **technical adapter** for Redis Pub/Sub — it has no domain logic.
- PubSub is a **cross-cutting concern** used by all modules for GraphQL subscriptions (real-time updates).

**Overlaps**:

- **Chat**: Publishes `messageSent` events (real-time message delivery).
- **Notification**: Could publish notification events (real-time notification delivery).
- **Presence**: Publishes `userPresenceChanged` events (real-time online status).
- **Errands**: Could publish `errandAssigned` events (real-time errand status updates).

**Verdict**: PubSub is an **infrastructure layer** (Ports & Adapters outer layer). Should remain as `infrastructure/pubsub/` or `common/pubsub/`.

## 3. Domain Model Audit

**No domain model** — PubSub is purely infrastructure.

- `PubSubInterface` (line 6-9) is an interface, not a domain entity.
- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — PubSub is correctly positioned as infrastructure.

- However, modules call `pubSub.publish` directly (e.g., ChatService line 171+) — tightly coupled to PubSub.
- Recommendation: Emit domain events instead, event handlers publish to PubSub.

## 5. Repository Pattern Gap

**Not applicable** — PubSub is infrastructure, not domain.

## 6. EIP Opportunities

**Message Channel (Pub/Sub)**:

- Current: Uses Redis Pub/Sub for GraphQL subscriptions (WebSocket real-time updates).
- This is correct usage of Pub/Sub pattern for real-time messaging.

**Decoupling domain from infrastructure**:

- Current: Modules call `pubSub.publish` directly (tightly coupled).
- Recommendation: Emit domain events (`MessageSent`), event handler listens and publishes to PubSub.
- Benefits: Decouples domain logic from PubSub infrastructure (can switch from Redis to RabbitMQ without changing domain code).

**Durability**:

- Redis Pub/Sub is **not durable** — if server restarts, in-flight messages are lost.
- For critical notifications (payment received, errand assigned), use BullMQ (persistent queue) in addition to PubSub.

## 7. Cross-Cutting Concerns

**Error handling**:

- No error handling in `publish` (line 34-36) — if Redis is down, error bubbles up.

**Logging**:

- No logging (should log published events for debugging real-time issues).

## 8. GraphQL-Specific Notes

**GraphQL subscriptions**:

- `asyncIterator` (line 38-40) is used by GraphQL resolvers for subscriptions.
- Example: `@Subscription(() => Message) messageSent() { return pubSub.asyncIterator('messageSent') }`.

**Subscription filtering**:

- Channels are typically scoped by user ID (e.g., `messageSent:${userId}`) to filter events per subscriber.

## 9. Target Structure

```
src/infrastructure/pubsub/  # OR src/common/pubsub/
  domain/
    IPubSubService.ts               # Port (interface)

  infrastructure/
    adapters/
      RedisPubSubAdapter.ts         # Adapter (implements IPubSubService)

  application/
    event-handlers/
      OnMessageSentBroadcast.ts     # Listens to MessageSent domain event → publishes to PubSub
      OnErrandAssignedBroadcast.ts  # Listens to ErrandAssigned → publishes to PubSub
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- PubSub is infrastructure — refactoring won't break domain logic.
- Current implementation is functional (no critical bugs).

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. PubSub is infrastructure — refactoring doesn't unlock domain modeling.
2. Decoupling domain events from PubSub can be done incrementally (after domain events are implemented).
3. Current implementation works — low urgency.

**Migration steps**:

1. **Extract IPubSubService interface** (port).
2. **Rename PubSubService to RedisPubSubAdapter** (adapter).
3. **Decouple domain from PubSub**:
   - Emit domain events (e.g., `MessageSent`).
   - Event handlers listen to domain events and publish to PubSub.
4. **Add logging** (published events for debugging).
5. **Add error handling** (fallback if Redis is down — log error, don't throw).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * PubSub message envelope for cross-module broadcasts.
 * // TODO: No dedicated Prisma model exists for transient pubsub payloads.
 */
class PubSubMessage {
  constructor(
    public readonly topic: string,
    public readonly payload: Record<string, unknown>,
    public readonly correlationId: string | null,
  );

  /**
   * Validates topic naming convention and payload presence.
   */
  validate(): void;
}

/**
 * Port for publish/subscribe broker operations.
 */
interface IPubSubService {
  /**
   * Publishes message to topic.
   */
  publish(message: PubSubMessage): Promise<void>;
}
```

### Repository Interface

```typescript
/**
 * Optional persistence contract for pubsub delivery telemetry.
 * // TODO: Decide whether to persist broker publish audit into WebhookEvent.
 */
interface IPubSubAuditRepository {
  /**
   * Stores metadata for attempted publish operations.
   */
  savePublishAudit(
    topic: string,
    success: boolean,
    occurredAt: Date,
  ): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Publishes domain events to websocket topic channels.
 */
class BroadcastDomainEventCommandHandler {
  /**
   * Translates incoming domain event payload into PubSubMessage and publishes.
   */
  execute(command: BroadcastDomainEventCommand): Promise<void>;
}

interface BroadcastDomainEventCommand {
  topic: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}
```

### Domain Events

```typescript
/**
 * Emitted when pubsub publish succeeds.
 */
class PubSubMessagePublishedEvent {
  constructor(
    public readonly topic: string,
    public readonly correlationId: string | null,
  );
}
```
