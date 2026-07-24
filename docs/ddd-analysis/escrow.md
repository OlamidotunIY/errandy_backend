# Escrow - DDD & EIP Analysis

## Current Responsibility

Escrow owns payment holds around accepted errands. It models a two-phase hold: funds are first secured for active work, then after completion the worker payout enters a clearance window before release to available wallet balance.

## Domain Model

`Escrow` is the aggregate root and `EscrowId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/escrow/
  domain/
    entities/
      Escrow.ts
    value-objects/
      EscrowId.ts
    errors/
      EscrowInvariantError.ts
    events/
      EscrowFundedEvent.ts
      EscrowReleasingEvent.ts
      EscrowReleasedEvent.ts
      EscrowRefundingEvent.ts
      EscrowRefundedEvent.ts
      EscrowDisputedEvent.ts
    repositories/
      IEscrowRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      FundEscrow/
        FundEscrowCommand.ts
        FundEscrowHandler.ts
      MarkEscrowCompleted/
        MarkEscrowCompletedCommand.ts
        MarkEscrowCompletedHandler.ts
      ReleaseEscrow/
        ReleaseEscrowCommand.ts
        ReleaseEscrowHandler.ts
      RefundEscrow/
        RefundEscrowCommand.ts
        RefundEscrowHandler.ts
    queries/
      GetEscrowByErrand/
        GetEscrowByErrandQuery.ts
        GetEscrowByErrandHandler.ts
    sagas/
      (none)
    event-handlers/
      OnErrandCompletedMarkEscrowHandler.ts
    jobs/
      ReleaseMaturedEscrowsJob.ts
      ReleaseMaturedEscrowsProcessor.ts
  infrastructure/
    repositories/
      PrismaEscrowRepository.ts
    mappers/
      EscrowMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      EscrowResolver.ts
    graphql/
      EscrowGraphQLType.type.ts
      mappers/
        toEscrowGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Escrow invariants; persistence ignorant and reconstituted by repositories. */
class Escrow extends AggregateRoot<EscrowId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Escrow;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Escrow;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Escrow; prevents cross-aggregate ID mix-ups. */
class EscrowId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): EscrowId;
}

/** Base domain error for violated Escrow invariants. */
class EscrowInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Escrow after its state transition is persisted. */
class EscrowFundedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Escrow after its state transition is persisted. */
class EscrowReleasingEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Escrow after its state transition is persisted. */
class EscrowReleasedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Escrow after its state transition is persisted. */
class EscrowRefundingEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Escrow after its state transition is persisted. */
class EscrowRefundedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Escrow after its state transition is persisted. */
class EscrowDisputedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Escrow; domain/application depend on this contract, not Prisma. */
interface IEscrowRepository {
  /** Loads an aggregate by ID. */
  findById(id: EscrowId): Promise<Escrow | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Escrow): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the FundEscrow use case. */
class FundEscrowCommand extends Command<FundEscrowResult> {
  /** Captures all input required by FundEscrowHandler. */
  constructor(public readonly payload: FundEscrowPayload);
}

/** Handles FundEscrowCommand through the NestJS CommandBus. */
@CommandHandler(FundEscrowCommand)
class FundEscrowHandler implements ICommandHandler<FundEscrowCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: FundEscrowCommand): Promise<FundEscrowResult>;
}

/** Command input for the MarkEscrowCompleted use case. */
class MarkEscrowCompletedCommand extends Command<void> {
  /** Captures all input required by MarkEscrowCompletedHandler. */
  constructor(public readonly payload: MarkEscrowCompletedPayload);
}

/** Handles MarkEscrowCompletedCommand through the NestJS CommandBus. */
@CommandHandler(MarkEscrowCompletedCommand)
class MarkEscrowCompletedHandler implements ICommandHandler<MarkEscrowCompletedCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: MarkEscrowCompletedCommand): Promise<void>;
}

/** Command input for the ReleaseEscrow use case. */
class ReleaseEscrowCommand extends Command<void> {
  /** Captures all input required by ReleaseEscrowHandler. */
  constructor(public readonly payload: ReleaseEscrowPayload);
}

/** Handles ReleaseEscrowCommand through the NestJS CommandBus. */
@CommandHandler(ReleaseEscrowCommand)
class ReleaseEscrowHandler implements ICommandHandler<ReleaseEscrowCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: ReleaseEscrowCommand): Promise<void>;
}

/** Command input for the RefundEscrow use case. */
class RefundEscrowCommand extends Command<void> {
  /** Captures all input required by RefundEscrowHandler. */
  constructor(public readonly payload: RefundEscrowPayload);
}

/** Handles RefundEscrowCommand through the NestJS CommandBus. */
@CommandHandler(RefundEscrowCommand)
class RefundEscrowHandler implements ICommandHandler<RefundEscrowCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RefundEscrowCommand): Promise<void>;
}

/** Query input for GetEscrowByErrand. */
class GetEscrowByErrandQuery extends Query<EscrowDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetEscrowByErrandPayload);
}

/** Handles GetEscrowByErrandQuery through the NestJS QueryBus. */
@QueryHandler(GetEscrowByErrandQuery)
class GetEscrowByErrandHandler implements IQueryHandler<GetEscrowByErrandQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetEscrowByErrandQuery): Promise<EscrowDTO | null>;
}

/** Event handler for ErrandCompletedEvent; uses buses rather than handler classes. */
@EventsHandler(ErrandCompletedEvent)
class OnErrandCompletedMarkEscrowHandler implements IEventHandler<ErrandCompletedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: ErrandCompletedEvent): Promise<void>;
}

/** Scheduler/query side for ReleaseMaturedEscrows; finds eligible records and enqueues one BullMQ job per record/window. */
class ReleaseMaturedEscrowsJob {
  /** Enqueues work; it never processes records inline during the scheduler tick. */
  async enqueueDueJobs(): Promise<void>;
}

/** BullMQ processor for ReleaseMaturedEscrows; dispatches use cases through CommandBus and uses retry/backoff. */
@Processor('ReleaseMaturedEscrows')
class ReleaseMaturedEscrowsProcessor {
  /** Processes one queued payload with attempts=5 and exponential backoff; DLQ payload includes original payload, correlationId, failure reason, attempt count, and every idempotency key or gatewayReference needed for safe replay. */
  async process(job: Job<ReleaseMaturedEscrowsPayload>): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IEscrowRepository; maps rows through EscrowMapper. */
@Injectable()
class PrismaEscrowRepository implements IEscrowRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: EscrowId): Promise<Escrow | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Escrow): Promise<void>;
}

/** Injectable mapper for Escrow; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class EscrowMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Escrow;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Escrow): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class EscrowResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for EscrowGraphQLType; separate from application DTOs. */
type EscrowGraphQLTypeShape = Omit<EscrowDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class EscrowGraphQLType implements EscrowGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toEscrowGraphQLType(dto: EscrowDTO): EscrowGraphQLType;

```

## EIP Patterns Applied

- **Saga / Process Manager**: Escrow participates in application acceptance and completion workflows through commands and events. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: errandId uniqueness and gateway idempotency keys prevent duplicate escrow funding. Status: fully specced with concrete signatures in the Implementation Spec.
- **Dead Letter Channel**: ReleaseMaturedEscrowsProcessor retries matured releases and stores failed payloads with escrowId for replay. Status: fully specced with concrete signatures in the Implementation Spec.
