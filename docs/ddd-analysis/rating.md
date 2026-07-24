# Rating - DDD & EIP Analysis

## Current Responsibility

Rating owns reviews, reactions, replies, and rating statistics produced after completed errands. The aggregate enforces score bounds, one rating per rater per errand, and reaction/reply ownership rules.

## Bounded Context Assessment

Rating is a distinct bounded context because it owns reviews, reactions, replies, rating statistics, score bounds, and one rating per rater per errand. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Rating` as the aggregate root and `RatingId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IRatingRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Rating` is the aggregate root and `RatingId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Rating {
  id String @id @map("_id")
  errandId String
  raterId String
  rateeId String
  score Int
  comment String?
  replyText String?
  repliedAt DateTime?
  createdAt DateTime
  updatedAt DateTime

  @@unique([errandId, raterId])
  @@index([rateeId, createdAt])
  @@index([raterId, createdAt])
}
```

Scalar-ID references and cleanup owners:
- `raterId` references Users. Cleanup owner: UserDeletedPolicyHandler anonymizes display data without rewriting rating history.
- `rateeId` references Users. Cleanup owner: UserDeletedPolicyHandler preserves scalar rating history for aggregate statistics.
- `errandId` references Errands. Cleanup owner: ErrandDeletedPolicyHandler prevents hard deletion of rated errands.
- `ratingId` references Rating. Cleanup owner: RatingDeletedPolicyHandler removes reactions and replies only through Rating aggregate behavior.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([errandId, raterId])` maps to `findByErrandAndRater / CreateRatingCommand`; domain error: `DuplicateRatingError`.
- `@@index([rateeId, createdAt])` maps to `GetUserRatingsQuery / GetRatingStatsQuery`; domain error: `none`.
- `@@index([raterId, createdAt])` maps to `user history reads`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


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

/**
 * Aggregate root for `Rating` invariants; persistence ignorant and reconstituted by repositories.
 * Constructor fields:
 * - `id` is the strongly typed aggregate identifier.
 * - Other constructor fields are the scalar/value-object state listed in the Persistence Model.
 * - Timestamps preserve creation/update history from persistence.
 */
class Rating extends AggregateRoot<RatingId> {
  /**
   * Creates a new `Rating` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Rating;

  /**
   * Rehydrates `Rating` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Rating;

  /**
   * Returns and clears queued domain events after a successful repository write.
   * 1. Copy the aggregate's queued domain events.
   * 2. Clear the aggregate's internal event buffer.
   * 3. Return the copied events to the application handler.
   * 4. Let the handler publish each event with `eventBus.publish(event)`.
   */
  pullDomainEvents(): DomainEvent[];
}

/**
 * Strongly typed identifier for Rating; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class RatingId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): RatingId;
}

/**
 * Base domain error for violated Rating invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class RatingInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Rating after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class RatingCreatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Rating after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class RatingReactionAddedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Rating after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class RatingReactionRemovedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Rating after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class RatingRepliedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Rating after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class RatingReplyUpdatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: RatingId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Rating; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IRatingRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `RatingMapper.toDomain(row)` when present.
   */
  findById(id: RatingId): Promise<Rating | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `RatingMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Rating`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Rating): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the CreateRating use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreateRatingCommand extends Command<RatingId> {
  /**
   * Captures all input required by CreateRatingHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CreateRatingPayload);
}

/**
 * Handles `CreateRatingCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` loads and saves `Rating` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Rating` state through `ratingRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Rating.createRating(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `ratingRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CreateRatingCommand)
class CreateRatingHandler implements ICommandHandler<CreateRatingCommand> {
  /**
   * Executes `CreateRatingCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Rating` state with `ratingRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Rating` domain method for `CreateRating` if not declared above.
   * 4. Persist with `ratingRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CreateRatingCommand): Promise<RatingId>;
}

/**
 * Command input for the AddRatingReaction use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class AddRatingReactionCommand extends Command<void> {
  /**
   * Captures all input required by AddRatingReactionHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: AddRatingReactionPayload);
}

/**
 * Handles `AddRatingReactionCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` loads and saves `Rating` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Rating` state through `ratingRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Rating.addRatingReaction(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `ratingRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(AddRatingReactionCommand)
class AddRatingReactionHandler implements ICommandHandler<AddRatingReactionCommand> {
  /**
   * Executes `AddRatingReactionCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Rating` state with `ratingRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Rating` domain method for `AddRatingReaction` if not declared above.
   * 4. Persist with `ratingRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: AddRatingReactionCommand): Promise<void>;
}

/**
 * Command input for the RemoveRatingReaction use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RemoveRatingReactionCommand extends Command<void> {
  /**
   * Captures all input required by RemoveRatingReactionHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: RemoveRatingReactionPayload);
}

/**
 * Handles `RemoveRatingReactionCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` loads and saves `Rating` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Rating` state through `ratingRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Rating.removeRatingReaction(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `ratingRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(RemoveRatingReactionCommand)
class RemoveRatingReactionHandler implements ICommandHandler<RemoveRatingReactionCommand> {
  /**
   * Executes `RemoveRatingReactionCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Rating` state with `ratingRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Rating` domain method for `RemoveRatingReaction` if not declared above.
   * 4. Persist with `ratingRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: RemoveRatingReactionCommand): Promise<void>;
}

/**
 * Command input for the AddRatingReply use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class AddRatingReplyCommand extends Command<void> {
  /**
   * Captures all input required by AddRatingReplyHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: AddRatingReplyPayload);
}

/**
 * Handles `AddRatingReplyCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` loads and saves `Rating` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Rating` state through `ratingRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Rating.addRatingReply(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `ratingRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(AddRatingReplyCommand)
class AddRatingReplyHandler implements ICommandHandler<AddRatingReplyCommand> {
  /**
   * Executes `AddRatingReplyCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Rating` state with `ratingRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Rating` domain method for `AddRatingReply` if not declared above.
   * 4. Persist with `ratingRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: AddRatingReplyCommand): Promise<void>;
}

/**
 * Command input for the UpdateRatingReply use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class UpdateRatingReplyCommand extends Command<void> {
  /**
   * Captures all input required by UpdateRatingReplyHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: UpdateRatingReplyPayload);
}

/**
 * Handles `UpdateRatingReplyCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` loads and saves `Rating` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Rating` state through `ratingRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Rating.updateRatingReply(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `ratingRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(UpdateRatingReplyCommand)
class UpdateRatingReplyHandler implements ICommandHandler<UpdateRatingReplyCommand> {
  /**
   * Executes `UpdateRatingReplyCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Rating` state with `ratingRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Rating` domain method for `UpdateRatingReply` if not declared above.
   * 4. Persist with `ratingRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: UpdateRatingReplyCommand): Promise<void>;
}

/**
 * Query input for GetRating.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetRatingQuery extends Query<RatingDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetRatingPayload);
}

/**
 * Handles `GetRatingQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` reads `Rating` persistence state.
 * - `RatingMapper: RatingMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `ratingRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `RatingMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetRatingQuery)
class GetRatingHandler implements IQueryHandler<GetRatingQuery> {
  /**
   * Executes `GetRatingQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `ratingRepository` or the module read model.
   * 3. Map rows with `RatingMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetRatingQuery): Promise<RatingDTO | null>;
}

/**
 * Query input for GetUserRatings.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetUserRatingsQuery extends Query<RatingDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetUserRatingsPayload);
}

/**
 * Handles `GetUserRatingsQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` reads `Rating` persistence state.
 * - `RatingMapper: RatingMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `ratingRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `RatingMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetUserRatingsQuery)
class GetUserRatingsHandler implements IQueryHandler<GetUserRatingsQuery> {
  /**
   * Executes `GetUserRatingsQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `ratingRepository` or the module read model.
   * 3. Map rows with `RatingMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetUserRatingsQuery): Promise<RatingDTO[]>;
}

/**
 * Query input for GetRatingStats.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetRatingStatsQuery extends Query<RatingStatsDTO> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetRatingStatsPayload);
}

/**
 * Handles `GetRatingStatsQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `ratingRepository: IRatingRepository` reads `Rating` persistence state.
 * - `RatingMapper: RatingMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `ratingRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `RatingMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetRatingStatsQuery)
class GetRatingStatsHandler implements IQueryHandler<GetRatingStatsQuery> {
  /**
   * Executes `GetRatingStatsQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `ratingRepository` or the module read model.
   * 3. Map rows with `RatingMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetRatingStatsQuery): Promise<RatingStatsDTO>;
}

/**
 * Event handler for `ErrandCompletedEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `ErrandCompletedEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(ErrandCompletedEvent)
class OnErrandCompletedPromptRatingHandler implements IEventHandler<ErrandCompletedEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: ErrandCompletedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IRatingRepository; maps rows through RatingMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaRatingRepository implements IRatingRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: RatingId): Promise<Rating | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Rating): Promise<void>;
}

/**
 * Injectable mapper for `Rating`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Rating.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class RatingMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Rating;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Rating): unknown;
}

/**
 * GraphQL resolver; injects CommandBus and QueryBus, never repositories.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches mutations.
 * - `queryBus: QueryBus` dispatches reads.
 * 1. Convert GraphQL inputs to commands or queries.
 * 2. Call `commandBus.execute(...)` or `queryBus.execute(...)`.
 * 3. Map application DTOs to GraphQL types before returning.
 */
@Resolver()
class RatingResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for RatingGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type RatingGraphQLTypeShape = Omit<RatingDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class RatingGraphQLType implements RatingGraphQLTypeShape {
  /**
   * String form of the strongly typed aggregate ID.
   * 1. Receive the application DTO ID as a primitive string.
   * 2. Expose it through `@Field()`.
   * 3. Do not leak EntityId objects to GraphQL clients.
   */
  @Field() id: string;
}

/**
 * Converts application DTOs to GraphQL types, including EntityId-to-string fields.
 * 1. Receive the application DTO returned by a query handler.
 * 2. Convert EntityId values to strings when present.
 * 3. Copy scalar fields to the GraphQL type.
 * 4. Return the presentation type.
 */
function toRatingGraphQLType(dto: RatingDTO): RatingGraphQLType;

/**
 * GraphQL shape for RatingStatsGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type RatingStatsGraphQLTypeShape = Omit<RatingStatsDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class RatingStatsGraphQLType implements RatingStatsGraphQLTypeShape {
  /**
   * String form of the strongly typed aggregate ID.
   * 1. Receive the application DTO ID as a primitive string.
   * 2. Expose it through `@Field()`.
   * 3. Do not leak EntityId objects to GraphQL clients.
   */
  @Field() id: string;
}

/**
 * Converts application DTOs to GraphQL types, including EntityId-to-string fields.
 * 1. Receive the application DTO returned by a query handler.
 * 2. Convert EntityId values to strings when present.
 * 3. Copy scalar fields to the GraphQL type.
 * 4. Return the presentation type.
 */
function toRatingStatsGraphQLType(dto: RatingStatsDTO): RatingStatsGraphQLType;

```

## EIP Patterns Applied

- **Materialized View**: RatingStatsDTO aggregates review counts and averages for Provider and Client read models. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: RatingCreatedEvent updates Provider and Client rating snapshots through event handlers. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: errandId/raterId uniqueness prevents duplicate ratings by the same participant. Status: fully specced with concrete signatures in the Implementation Spec.
