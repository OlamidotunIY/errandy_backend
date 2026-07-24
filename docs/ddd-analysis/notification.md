# Notification - DDD & EIP Analysis

## Current Responsibility

Notification owns notification requests and dispatch history. Delivery adapters for push, email, and SMS are infrastructure dependencies; domain logic decides recipient, channel set, payload, status, and retry identity.

## Domain Model

`NotificationRequest` is the aggregate root and `NotificationId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/notification/
  domain/
    entities/
      NotificationRequest.ts
    value-objects/
      NotificationId.ts
    errors/
      NotificationRequestInvariantError.ts
    events/
      NotificationDispatchRequestedEvent.ts
      NotificationDispatchedEvent.ts
      NotificationDispatchFailedEvent.ts
    repositories/
      INotificationHistoryRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      SendNotification/
        SendNotificationCommand.ts
        SendNotificationHandler.ts
    queries/
      GetNotificationHistory/
        GetNotificationHistoryQuery.ts
        GetNotificationHistoryHandler.ts
    sagas/
      (none)
    event-handlers/
      OnDomainEventSendNotificationHandler.ts
    jobs/
      RetryFailedNotificationJob.ts
      RetryFailedNotificationProcessor.ts
  infrastructure/
    repositories/
      PrismaNotificationRequestRepository.ts
    mappers/
      NotificationMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      NotificationResolver.ts
    graphql/
      NotificationGraphQLType.type.ts
      mappers/
        toNotificationGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Notification invariants; persistence ignorant and reconstituted by repositories. */
class NotificationRequest extends AggregateRoot<NotificationId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): NotificationRequest;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): NotificationRequest;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for NotificationRequest; prevents cross-aggregate ID mix-ups. */
class NotificationId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): NotificationId;
}

/** Base domain error for violated Notification invariants. */
class NotificationRequestInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by NotificationRequest after its state transition is persisted. */
class NotificationDispatchRequestedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: NotificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by NotificationRequest after its state transition is persisted. */
class NotificationDispatchedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: NotificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by NotificationRequest after its state transition is persisted. */
class NotificationDispatchFailedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: NotificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for NotificationRequest; domain/application depend on this contract, not Prisma. */
interface INotificationHistoryRepository {
  /** Loads an aggregate by ID. */
  findById(id: NotificationId): Promise<NotificationRequest | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: NotificationRequest): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the SendNotification use case. */
class SendNotificationCommand extends Command<void> {
  /** Captures all input required by SendNotificationHandler. */
  constructor(public readonly payload: SendNotificationPayload);
}

/** Handles SendNotificationCommand through the NestJS CommandBus. */
@CommandHandler(SendNotificationCommand)
class SendNotificationHandler implements ICommandHandler<SendNotificationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: SendNotificationCommand): Promise<void>;
}

/** Query input for GetNotificationHistory. */
class GetNotificationHistoryQuery extends Query<NotificationDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetNotificationHistoryPayload);
}

/** Handles GetNotificationHistoryQuery through the NestJS QueryBus. */
@QueryHandler(GetNotificationHistoryQuery)
class GetNotificationHistoryHandler implements IQueryHandler<GetNotificationHistoryQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetNotificationHistoryQuery): Promise<NotificationDTO[]>;
}

/** Event handler for DomainEvent; uses buses rather than handler classes. */
@EventsHandler(DomainEvent)
class OnDomainEventSendNotificationHandler implements IEventHandler<DomainEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: DomainEvent): Promise<void>;
}

/** Scheduler/query side for RetryFailedNotification; finds eligible records and enqueues one BullMQ job per record/window. */
class RetryFailedNotificationJob {
  /** Enqueues work; it never processes records inline during the scheduler tick. */
  async enqueueDueJobs(): Promise<void>;
}

/** BullMQ processor for RetryFailedNotification; dispatches use cases through CommandBus and uses retry/backoff. */
@Processor('RetryFailedNotification')
class RetryFailedNotificationProcessor {
  /** Processes one queued payload with attempts=5 and exponential backoff; DLQ payload includes original payload, correlationId, failure reason, attempt count, and every idempotency key or gatewayReference needed for safe replay. */
  async process(job: Job<RetryFailedNotificationPayload>): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of INotificationHistoryRepository; maps rows through NotificationMapper. */
@Injectable()
class PrismaNotificationRequestRepository implements INotificationHistoryRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: NotificationId): Promise<NotificationRequest | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: NotificationRequest): Promise<void>;
}

/** Injectable mapper for NotificationRequest; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class NotificationMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): NotificationRequest;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: NotificationRequest): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class NotificationResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for NotificationGraphQLType; separate from application DTOs. */
type NotificationGraphQLTypeShape = Omit<NotificationDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class NotificationGraphQLType implements NotificationGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toNotificationGraphQLType(dto: NotificationDTO): NotificationGraphQLType;

```

## EIP Patterns Applied

- **Message Translator**: Domain events are translated into channel-specific notification payloads without leaking adapter details. Status: fully specced with concrete signatures in the Implementation Spec.
- **Dead Letter Channel**: RetryFailedNotificationProcessor retries failed dispatches and records exhausted payloads with recipient, channels, template, and correlationId. Status: fully specced with concrete signatures in the Implementation Spec.
