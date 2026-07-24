# Errands - DDD & EIP Analysis

## Current Responsibility

Errands owns task lifecycle, publication, assignment, completion, cancellation, pricing, recurrence metadata, and service/category references. Payment, applications, chat, escrow, and ratings react through commands and events rather than mutating Errand internals directly.

## Bounded Context Assessment

Errands is a distinct bounded context because it owns task lifecycle, publication, assignment, completion, cancellation, pricing, and recurrence metadata. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Errand` as the aggregate root and `ErrandId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IErrandRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Errand` is the aggregate root and `ErrandId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Errand {
  id String @id @map("_id")
  clientId String
  providerId String?
  assignedTo String?
  serviceId String
  title String
  description String
  status ErrandStatus
  pricingType PricingType
  amountKobo Int?
  currency String?
  latitude Float?
  longitude Float?
  publishedAt DateTime?
  completedAt DateTime?
  cancelledAt DateTime?
  createdAt DateTime
  updatedAt DateTime

  @@index([id])
  @@index([clientId, status])
  @@index([assignedTo, status])
  @@index([status, serviceId])
  @@index([latitude, longitude])
}
```

Scalar-ID references and cleanup owners:
- `clientId` references Client. Cleanup owner: ClientDeletedPolicyHandler prevents destructive deletion or anonymizes display while preserving errand history.
- `providerId` references Provider. Cleanup owner: ProviderDeletedPolicyHandler clears or preserves provider references through Errand commands according to status.
- `assignedTo` references Provider. Cleanup owner: ProviderDeletedPolicyHandler prevents deletion while active assigned errands exist.
- `serviceId` references Service. Cleanup owner: ServiceRetiredHandler preserves serviceId for historical errands and prevents unsafe catalog removal.

Indexes and constraints mapped to repository methods/domain errors:
- `@@index([id])` maps to `findById`; domain error: `none`.
- `@@index([clientId, status])` maps to `GetMyErrandsQuery / cleanup policies`; domain error: `none`.
- `@@index([assignedTo, status])` maps to `GetMyErrandsQuery / assigned-work reads`; domain error: `none`.
- `@@index([status, serviceId])` maps to `GetPersonalizedFeedQuery`; domain error: `none`.
- `@@index([latitude, longitude])` maps to `GetPersonalizedFeedQuery geospatial filtering`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


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

/**
 * Aggregate root for Errands invariants; persistence ignorant and reconstituted by repositories.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class Errand extends AggregateRoot<ErrandId> {
  /**
   * Creates a new `Errand` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Errand;

  /**
   * Rehydrates `Errand` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Errand;

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
 * Strongly typed identifier for Errand; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class ErrandId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): ErrandId;
}

/**
 * Base domain error for violated Errands invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class ErrandInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Errand after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ErrandCreatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Errand after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ErrandPublishedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Errand after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ErrandAssignedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Errand after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ErrandCompletedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Errand after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ErrandCancelledEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ErrandId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Errand; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IErrandRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `ErrandMapper.toDomain(row)` when present.
   */
  findById(id: ErrandId): Promise<Errand | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `ErrandMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Errand`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Errand): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the CreateErrand use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreateErrandCommand extends Command<ErrandId> {
  /**
   * Captures all input required by CreateErrandHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CreateErrandPayload);
}

/**
 * Handles `CreateErrandCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` loads and saves `Errand` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Errand` state through `errandRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Errand.createErrand(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `errandRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CreateErrandCommand)
class CreateErrandHandler implements ICommandHandler<CreateErrandCommand> {
  /**
   * Executes `CreateErrandCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Errand` state with `errandRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Errand` domain method for `CreateErrand` if not declared above.
   * 4. Persist with `errandRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CreateErrandCommand): Promise<ErrandId>;
}

/**
 * Command input for the PublishErrand use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class PublishErrandCommand extends Command<void> {
  /**
   * Captures all input required by PublishErrandHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: PublishErrandPayload);
}

/**
 * Handles `PublishErrandCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` loads and saves `Errand` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Errand` state through `errandRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Errand.publishErrand(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `errandRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(PublishErrandCommand)
class PublishErrandHandler implements ICommandHandler<PublishErrandCommand> {
  /**
   * Executes `PublishErrandCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Errand` state with `errandRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Errand` domain method for `PublishErrand` if not declared above.
   * 4. Persist with `errandRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: PublishErrandCommand): Promise<void>;
}

/**
 * Command input for the AssignWorker use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class AssignWorkerCommand extends Command<void> {
  /**
   * Captures all input required by AssignWorkerHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: AssignWorkerPayload);
}

/**
 * Handles `AssignWorkerCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` loads and saves `Errand` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Errand` state through `errandRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Errand.assignWorker(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `errandRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(AssignWorkerCommand)
class AssignWorkerHandler implements ICommandHandler<AssignWorkerCommand> {
  /**
   * Executes `AssignWorkerCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Errand` state with `errandRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Errand` domain method for `AssignWorker` if not declared above.
   * 4. Persist with `errandRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: AssignWorkerCommand): Promise<void>;
}

/**
 * Command input for the CompleteErrand use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CompleteErrandCommand extends Command<void> {
  /**
   * Captures all input required by CompleteErrandHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CompleteErrandPayload);
}

/**
 * Handles `CompleteErrandCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` loads and saves `Errand` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Errand` state through `errandRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Errand.completeErrand(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `errandRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CompleteErrandCommand)
class CompleteErrandHandler implements ICommandHandler<CompleteErrandCommand> {
  /**
   * Executes `CompleteErrandCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Errand` state with `errandRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Errand` domain method for `CompleteErrand` if not declared above.
   * 4. Persist with `errandRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CompleteErrandCommand): Promise<void>;
}

/**
 * Command input for the CancelErrand use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CancelErrandCommand extends Command<void> {
  /**
   * Captures all input required by CancelErrandHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CancelErrandPayload);
}

/**
 * Handles `CancelErrandCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` loads and saves `Errand` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Errand` state through `errandRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Errand.cancelErrand(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `errandRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CancelErrandCommand)
class CancelErrandHandler implements ICommandHandler<CancelErrandCommand> {
  /**
   * Executes `CancelErrandCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Errand` state with `errandRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Errand` domain method for `CancelErrand` if not declared above.
   * 4. Persist with `errandRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CancelErrandCommand): Promise<void>;
}

/**
 * Query input for GetErrandById.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetErrandByIdQuery extends Query<ErrandDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetErrandByIdPayload);
}

/**
 * Handles `GetErrandByIdQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` reads `Errand` persistence state.
 * - `ErrandMapper: ErrandMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `errandRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ErrandMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetErrandByIdQuery)
class GetErrandByIdHandler implements IQueryHandler<GetErrandByIdQuery> {
  /**
   * Executes `GetErrandByIdQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `errandRepository` or the module read model.
   * 3. Map rows with `ErrandMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetErrandByIdQuery): Promise<ErrandDTO | null>;
}

/**
 * Query input for GetPersonalizedFeed.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetPersonalizedFeedQuery extends Query<ErrandFeedItemDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetPersonalizedFeedPayload);
}

/**
 * Handles `GetPersonalizedFeedQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` reads `Errand` persistence state.
 * - `ErrandMapper: ErrandMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `errandRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ErrandMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetPersonalizedFeedQuery)
class GetPersonalizedFeedHandler implements IQueryHandler<GetPersonalizedFeedQuery> {
  /**
   * Executes `GetPersonalizedFeedQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `errandRepository` or the module read model.
   * 3. Map rows with `ErrandMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetPersonalizedFeedQuery): Promise<ErrandFeedItemDTO[]>;
}

/**
 * Query input for GetMyErrands.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetMyErrandsQuery extends Query<ErrandDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetMyErrandsPayload);
}

/**
 * Handles `GetMyErrandsQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `errandRepository: IErrandRepository` reads `Errand` persistence state.
 * - `ErrandMapper: ErrandMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `errandRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ErrandMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetMyErrandsQuery)
class GetMyErrandsHandler implements IQueryHandler<GetMyErrandsQuery> {
  /**
   * Executes `GetMyErrandsQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `errandRepository` or the module read model.
   * 3. Map rows with `ErrandMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetMyErrandsQuery): Promise<ErrandDTO[]>;
}

/**
 * Process manager that reacts to ErrandCompletedEvent and dispatches follow-up commands through CommandBus.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class CompleteErrandSaga {
  /**
   * Creates the saga with CommandBus, EventBus, and logger dependencies.
   * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
   * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
   */
  constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus);

  /**
   * Handles the triggering event and dispatches commands with commandBus.execute(new XCommand(...)).
   * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
   * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
   */
  async handle(event: ErrandCompletedEvent): Promise<void>;
}

/**
 * Process manager that reacts to ErrandCancelledEvent and dispatches follow-up commands through CommandBus.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class CancelErrandSaga {
  /**
   * Creates the saga with CommandBus, EventBus, and logger dependencies.
   * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
   * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
   */
  constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus);

  /**
   * Handles the triggering event and dispatches commands with commandBus.execute(new XCommand(...)).
   * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
   * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
   */
  async handle(event: ErrandCancelledEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IErrandRepository; maps rows through ErrandMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaErrandRepository implements IErrandRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: ErrandId): Promise<Errand | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Errand): Promise<void>;
}

/**
 * Injectable mapper for `Errand`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Errand.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class ErrandMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Errand;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Errand): unknown;
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
class ErrandsResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for ErrandGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ErrandGraphQLTypeShape = Omit<ErrandDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ErrandGraphQLType implements ErrandGraphQLTypeShape {
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
function toErrandGraphQLType(dto: ErrandDTO): ErrandGraphQLType;

/**
 * GraphQL shape for ErrandFeedItemGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ErrandFeedItemGraphQLTypeShape = Omit<ErrandFeedItemDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ErrandFeedItemGraphQLType implements ErrandFeedItemGraphQLTypeShape {
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
function toErrandFeedItemGraphQLType(dto: ErrandFeedItemDTO): ErrandFeedItemGraphQLType;

```

## EIP Patterns Applied

- **Saga / Process Manager**: Completion and cancellation coordinate Escrow, Wallet, Rating, Chat, and Notification through events and commands. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Feed queries route by requester role, location, service, status, and trust relationship. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: Errand lifecycle transitions emit domain events after save so other modules react asynchronously. Status: fully specced with concrete signatures in the Implementation Spec.
