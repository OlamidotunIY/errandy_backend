# Errands - DDD & EIP Analysis

## Current Responsibility

Errands owns task lifecycle, publication, assignment, completion, cancellation, pricing, recurrence metadata, and service/category references. Payment, applications, chat, escrow, and ratings react through commands and events rather than mutating Errand internals directly.

## Domain Model

`Errand` is the aggregate root and `ErrandId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/errands/
  domain/
    entities/
      Errand.ts
    value-objects/
      ErrandId.ts
    errors/
      ErrandInvariantError.ts
    events/
      ErrandCreatedEvent.ts
      ErrandPublishedEvent.ts
      ErrandAssignedEvent.ts
      ErrandCompletedEvent.ts
      ErrandCancelledEvent.ts
    repositories/
      IErrandRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      CreateErrand/
        CreateErrandCommand.ts
        CreateErrandHandler.ts
      PublishErrand/
        PublishErrandCommand.ts
        PublishErrandHandler.ts
      AssignWorker/
        AssignWorkerCommand.ts
        AssignWorkerHandler.ts
      CompleteErrand/
        CompleteErrandCommand.ts
        CompleteErrandHandler.ts
      CancelErrand/
        CancelErrandCommand.ts
        CancelErrandHandler.ts
    queries/
      GetErrandById/
        GetErrandByIdQuery.ts
        GetErrandByIdHandler.ts
      GetPersonalizedFeed/
        GetPersonalizedFeedQuery.ts
        GetPersonalizedFeedHandler.ts
      GetMyErrands/
        GetMyErrandsQuery.ts
        GetMyErrandsHandler.ts
    sagas/
      CompleteErrandSaga.ts
      CancelErrandSaga.ts
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaErrandRepository.ts
    mappers/
      ErrandMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      ErrandsResolver.ts
    graphql/
      ErrandGraphQLType.type.ts
      ErrandFeedItemGraphQLType.type.ts
      mappers/
        toErrandGraphQLType.ts
        toErrandFeedItemGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Errands invariants; persistence ignorant and reconstituted by repositories. */
class Errand extends AggregateRoot<ErrandId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Errand;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Errand;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Errand; prevents cross-aggregate ID mix-ups. */
class ErrandId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): ErrandId;
}

/** Base domain error for violated Errands invariants. */
class ErrandInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Errand after its state transition is persisted. */
class ErrandCreatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Errand after its state transition is persisted. */
class ErrandPublishedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Errand after its state transition is persisted. */
class ErrandAssignedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Errand after its state transition is persisted. */
class ErrandCompletedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Errand after its state transition is persisted. */
class ErrandCancelledEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Errand; domain/application depend on this contract, not Prisma. */
interface IErrandRepository {
  /** Loads an aggregate by ID. */
  findById(id: ErrandId): Promise<Errand | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Errand): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the CreateErrand use case. */
class CreateErrandCommand extends Command<ErrandId> {
  /** Captures all input required by CreateErrandHandler. */
  constructor(public readonly payload: CreateErrandPayload);
}

/** Handles CreateErrandCommand through the NestJS CommandBus. */
@CommandHandler(CreateErrandCommand)
class CreateErrandHandler implements ICommandHandler<CreateErrandCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CreateErrandCommand): Promise<ErrandId>;
}

/** Command input for the PublishErrand use case. */
class PublishErrandCommand extends Command<void> {
  /** Captures all input required by PublishErrandHandler. */
  constructor(public readonly payload: PublishErrandPayload);
}

/** Handles PublishErrandCommand through the NestJS CommandBus. */
@CommandHandler(PublishErrandCommand)
class PublishErrandHandler implements ICommandHandler<PublishErrandCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: PublishErrandCommand): Promise<void>;
}

/** Command input for the AssignWorker use case. */
class AssignWorkerCommand extends Command<void> {
  /** Captures all input required by AssignWorkerHandler. */
  constructor(public readonly payload: AssignWorkerPayload);
}

/** Handles AssignWorkerCommand through the NestJS CommandBus. */
@CommandHandler(AssignWorkerCommand)
class AssignWorkerHandler implements ICommandHandler<AssignWorkerCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AssignWorkerCommand): Promise<void>;
}

/** Command input for the CompleteErrand use case. */
class CompleteErrandCommand extends Command<void> {
  /** Captures all input required by CompleteErrandHandler. */
  constructor(public readonly payload: CompleteErrandPayload);
}

/** Handles CompleteErrandCommand through the NestJS CommandBus. */
@CommandHandler(CompleteErrandCommand)
class CompleteErrandHandler implements ICommandHandler<CompleteErrandCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CompleteErrandCommand): Promise<void>;
}

/** Command input for the CancelErrand use case. */
class CancelErrandCommand extends Command<void> {
  /** Captures all input required by CancelErrandHandler. */
  constructor(public readonly payload: CancelErrandPayload);
}

/** Handles CancelErrandCommand through the NestJS CommandBus. */
@CommandHandler(CancelErrandCommand)
class CancelErrandHandler implements ICommandHandler<CancelErrandCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CancelErrandCommand): Promise<void>;
}

/** Query input for GetErrandById. */
class GetErrandByIdQuery extends Query<ErrandDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetErrandByIdPayload);
}

/** Handles GetErrandByIdQuery through the NestJS QueryBus. */
@QueryHandler(GetErrandByIdQuery)
class GetErrandByIdHandler implements IQueryHandler<GetErrandByIdQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetErrandByIdQuery): Promise<ErrandDTO | null>;
}

/** Query input for GetPersonalizedFeed. */
class GetPersonalizedFeedQuery extends Query<ErrandFeedItemDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetPersonalizedFeedPayload);
}

/** Handles GetPersonalizedFeedQuery through the NestJS QueryBus. */
@QueryHandler(GetPersonalizedFeedQuery)
class GetPersonalizedFeedHandler implements IQueryHandler<GetPersonalizedFeedQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetPersonalizedFeedQuery): Promise<ErrandFeedItemDTO[]>;
}

/** Query input for GetMyErrands. */
class GetMyErrandsQuery extends Query<ErrandDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetMyErrandsPayload);
}

/** Handles GetMyErrandsQuery through the NestJS QueryBus. */
@QueryHandler(GetMyErrandsQuery)
class GetMyErrandsHandler implements IQueryHandler<GetMyErrandsQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetMyErrandsQuery): Promise<ErrandDTO[]>;
}

/** Process manager that reacts to ErrandCompletedEvent and dispatches follow-up commands through CommandBus. */
class CompleteErrandSaga {
  /** Creates the saga with CommandBus, EventBus, and logger dependencies. */
  constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus);

  /** Handles the triggering event and dispatches commands with commandBus.execute(new XCommand(...)). */
  async handle(event: ErrandCompletedEvent): Promise<void>;
}

/** Process manager that reacts to ErrandCancelledEvent and dispatches follow-up commands through CommandBus. */
class CancelErrandSaga {
  /** Creates the saga with CommandBus, EventBus, and logger dependencies. */
  constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus);

  /** Handles the triggering event and dispatches commands with commandBus.execute(new XCommand(...)). */
  async handle(event: ErrandCancelledEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IErrandRepository; maps rows through ErrandMapper. */
@Injectable()
class PrismaErrandRepository implements IErrandRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: ErrandId): Promise<Errand | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Errand): Promise<void>;
}

/** Injectable mapper for Errand; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class ErrandMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Errand;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Errand): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class ErrandsResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for ErrandGraphQLType; separate from application DTOs. */
type ErrandGraphQLTypeShape = Omit<ErrandDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ErrandGraphQLType implements ErrandGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toErrandGraphQLType(dto: ErrandDTO): ErrandGraphQLType;

/** GraphQL shape for ErrandFeedItemGraphQLType; separate from application DTOs. */
type ErrandFeedItemGraphQLTypeShape = Omit<ErrandFeedItemDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ErrandFeedItemGraphQLType implements ErrandFeedItemGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toErrandFeedItemGraphQLType(dto: ErrandFeedItemDTO): ErrandFeedItemGraphQLType;

```

## EIP Patterns Applied

- **Saga / Process Manager**: Completion and cancellation coordinate Escrow, Wallet, Rating, Chat, and Notification through events and commands. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Feed queries route by requester role, location, service, status, and trust relationship. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: Errand lifecycle transitions emit domain events after save so other modules react asynchronously. Status: fully specced with concrete signatures in the Implementation Spec.
