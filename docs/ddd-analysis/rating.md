# Rating - DDD & EIP Analysis

## Current Responsibility

Rating owns reviews, reactions, replies, and rating statistics produced after completed errands. The aggregate enforces score bounds, one rating per rater per errand, and reaction/reply ownership rules.

## Domain Model

`Rating` is the aggregate root and `RatingId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/rating/
  domain/
    entities/
      Rating.ts
    value-objects/
      RatingId.ts
    errors/
      RatingInvariantError.ts
    events/
      RatingCreatedEvent.ts
      RatingReactionAddedEvent.ts
      RatingReactionRemovedEvent.ts
      RatingRepliedEvent.ts
      RatingReplyUpdatedEvent.ts
    repositories/
      IRatingRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      CreateRating/
        CreateRatingCommand.ts
        CreateRatingHandler.ts
      AddRatingReaction/
        AddRatingReactionCommand.ts
        AddRatingReactionHandler.ts
      RemoveRatingReaction/
        RemoveRatingReactionCommand.ts
        RemoveRatingReactionHandler.ts
      AddRatingReply/
        AddRatingReplyCommand.ts
        AddRatingReplyHandler.ts
      UpdateRatingReply/
        UpdateRatingReplyCommand.ts
        UpdateRatingReplyHandler.ts
    queries/
      GetRating/
        GetRatingQuery.ts
        GetRatingHandler.ts
      GetUserRatings/
        GetUserRatingsQuery.ts
        GetUserRatingsHandler.ts
      GetRatingStats/
        GetRatingStatsQuery.ts
        GetRatingStatsHandler.ts
    sagas/
      (none)
    event-handlers/
      OnErrandCompletedPromptRatingHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaRatingRepository.ts
    mappers/
      RatingMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      RatingResolver.ts
    graphql/
      RatingGraphQLType.type.ts
      RatingStatsGraphQLType.type.ts
      mappers/
        toRatingGraphQLType.ts
        toRatingStatsGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Rating invariants; persistence ignorant and reconstituted by repositories. */
class Rating extends AggregateRoot<RatingId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Rating;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Rating;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Rating; prevents cross-aggregate ID mix-ups. */
class RatingId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): RatingId;
}

/** Base domain error for violated Rating invariants. */
class RatingInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Rating after its state transition is persisted. */
class RatingCreatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Rating after its state transition is persisted. */
class RatingReactionAddedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Rating after its state transition is persisted. */
class RatingReactionRemovedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Rating after its state transition is persisted. */
class RatingRepliedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Rating after its state transition is persisted. */
class RatingReplyUpdatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Rating; domain/application depend on this contract, not Prisma. */
interface IRatingRepository {
  /** Loads an aggregate by ID. */
  findById(id: RatingId): Promise<Rating | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Rating): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the CreateRating use case. */
class CreateRatingCommand extends Command<RatingId> {
  /** Captures all input required by CreateRatingHandler. */
  constructor(public readonly payload: CreateRatingPayload);
}

/** Handles CreateRatingCommand through the NestJS CommandBus. */
@CommandHandler(CreateRatingCommand)
class CreateRatingHandler implements ICommandHandler<CreateRatingCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CreateRatingCommand): Promise<RatingId>;
}

/** Command input for the AddRatingReaction use case. */
class AddRatingReactionCommand extends Command<void> {
  /** Captures all input required by AddRatingReactionHandler. */
  constructor(public readonly payload: AddRatingReactionPayload);
}

/** Handles AddRatingReactionCommand through the NestJS CommandBus. */
@CommandHandler(AddRatingReactionCommand)
class AddRatingReactionHandler implements ICommandHandler<AddRatingReactionCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AddRatingReactionCommand): Promise<void>;
}

/** Command input for the RemoveRatingReaction use case. */
class RemoveRatingReactionCommand extends Command<void> {
  /** Captures all input required by RemoveRatingReactionHandler. */
  constructor(public readonly payload: RemoveRatingReactionPayload);
}

/** Handles RemoveRatingReactionCommand through the NestJS CommandBus. */
@CommandHandler(RemoveRatingReactionCommand)
class RemoveRatingReactionHandler implements ICommandHandler<RemoveRatingReactionCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RemoveRatingReactionCommand): Promise<void>;
}

/** Command input for the AddRatingReply use case. */
class AddRatingReplyCommand extends Command<void> {
  /** Captures all input required by AddRatingReplyHandler. */
  constructor(public readonly payload: AddRatingReplyPayload);
}

/** Handles AddRatingReplyCommand through the NestJS CommandBus. */
@CommandHandler(AddRatingReplyCommand)
class AddRatingReplyHandler implements ICommandHandler<AddRatingReplyCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AddRatingReplyCommand): Promise<void>;
}

/** Command input for the UpdateRatingReply use case. */
class UpdateRatingReplyCommand extends Command<void> {
  /** Captures all input required by UpdateRatingReplyHandler. */
  constructor(public readonly payload: UpdateRatingReplyPayload);
}

/** Handles UpdateRatingReplyCommand through the NestJS CommandBus. */
@CommandHandler(UpdateRatingReplyCommand)
class UpdateRatingReplyHandler implements ICommandHandler<UpdateRatingReplyCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: UpdateRatingReplyCommand): Promise<void>;
}

/** Query input for GetRating. */
class GetRatingQuery extends Query<RatingDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetRatingPayload);
}

/** Handles GetRatingQuery through the NestJS QueryBus. */
@QueryHandler(GetRatingQuery)
class GetRatingHandler implements IQueryHandler<GetRatingQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetRatingQuery): Promise<RatingDTO | null>;
}

/** Query input for GetUserRatings. */
class GetUserRatingsQuery extends Query<RatingDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetUserRatingsPayload);
}

/** Handles GetUserRatingsQuery through the NestJS QueryBus. */
@QueryHandler(GetUserRatingsQuery)
class GetUserRatingsHandler implements IQueryHandler<GetUserRatingsQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetUserRatingsQuery): Promise<RatingDTO[]>;
}

/** Query input for GetRatingStats. */
class GetRatingStatsQuery extends Query<RatingStatsDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetRatingStatsPayload);
}

/** Handles GetRatingStatsQuery through the NestJS QueryBus. */
@QueryHandler(GetRatingStatsQuery)
class GetRatingStatsHandler implements IQueryHandler<GetRatingStatsQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetRatingStatsQuery): Promise<RatingStatsDTO>;
}

/** Event handler for ErrandCompletedEvent; uses buses rather than handler classes. */
@EventsHandler(ErrandCompletedEvent)
class OnErrandCompletedPromptRatingHandler implements IEventHandler<ErrandCompletedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: ErrandCompletedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IRatingRepository; maps rows through RatingMapper. */
@Injectable()
class PrismaRatingRepository implements IRatingRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: RatingId): Promise<Rating | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Rating): Promise<void>;
}

/** Injectable mapper for Rating; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class RatingMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Rating;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Rating): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class RatingResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for RatingGraphQLType; separate from application DTOs. */
type RatingGraphQLTypeShape = Omit<RatingDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class RatingGraphQLType implements RatingGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toRatingGraphQLType(dto: RatingDTO): RatingGraphQLType;

/** GraphQL shape for RatingStatsGraphQLType; separate from application DTOs. */
type RatingStatsGraphQLTypeShape = Omit<RatingStatsDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class RatingStatsGraphQLType implements RatingStatsGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toRatingStatsGraphQLType(dto: RatingStatsDTO): RatingStatsGraphQLType;

```

## EIP Patterns Applied

- **Materialized View**: RatingStatsDTO aggregates review counts and averages for Provider and Client read models. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: RatingCreatedEvent updates Provider and Client rating snapshots through event handlers. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: errandId/raterId uniqueness prevents duplicate ratings by the same participant. Status: fully specced with concrete signatures in the Implementation Spec.
