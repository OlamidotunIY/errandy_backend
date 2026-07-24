# Provider - DDD & EIP Analysis

## Current Responsibility

Provider owns worker-facing profile state: skills, services, verification state, discovery attributes, and aggregate rating snapshot. Rating remains the source of individual reviews; Provider stores only the query-optimized rating summary.

## Bounded Context Assessment

Provider is a distinct bounded context because it owns worker profile, skills, services, verification state, discovery attributes, and rating snapshot. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Provider` as the aggregate root and `ProviderId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IProviderRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Provider` is the aggregate root and `ProviderId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Provider {
  id String @id @map("_id")
  userId String
  displayName String?
  bio String?
  skills String[]
  serviceIds String[]
  verified Boolean
  ratingAverage Float
  ratingCount Int
  discoveryScore Float?
  createdAt DateTime
  updatedAt DateTime

  @@unique([userId])
  @@index([verified, ratingAverage])
  @@index([serviceIds])
}
```

Scalar-ID references and cleanup owners:
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler deactivates or soft-deletes provider profiles through Provider commands.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([userId])` maps to `findByUserId / CreateProviderCommand`; domain error: `ProviderAlreadyExistsError`.
- `@@index([verified, ratingAverage])` maps to `DiscoverProvidersQuery`; domain error: `none`.
- `@@index([serviceIds])` maps to `SearchProvidersQuery / DiscoverProvidersQuery`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


## Target Structure

```text
src/provider/
  domain/
    entities/
      Provider.ts
    value-objects/
      ProviderId.ts
    errors/
      ProviderInvariantError.ts
    events/
      ProviderCreatedEvent.ts
      ProviderProfileUpdatedEvent.ts
      ProviderVerifiedEvent.ts
      ProviderRatingSnapshotUpdatedEvent.ts
    repositories/
      IProviderRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      CreateProvider/
        CreateProviderCommand.ts
        CreateProviderHandler.ts
      UpdateProviderProfile/
        UpdateProviderProfileCommand.ts
        UpdateProviderProfileHandler.ts
      VerifyProvider/
        VerifyProviderCommand.ts
        VerifyProviderHandler.ts
      UpdateProviderRatingSnapshot/
        UpdateProviderRatingSnapshotCommand.ts
        UpdateProviderRatingSnapshotHandler.ts
    queries/
      GetProvider/
        GetProviderQuery.ts
        GetProviderHandler.ts
      DiscoverProviders/
        DiscoverProvidersQuery.ts
        DiscoverProvidersHandler.ts
      SearchProviders/
        SearchProvidersQuery.ts
        SearchProvidersHandler.ts
    sagas/
      (none)
    event-handlers/
      OnRatingCreatedUpdateProviderRatingHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaProviderRepository.ts
    mappers/
      ProviderMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      ProviderResolver.ts
    graphql/
      ProviderGraphQLType.type.ts
      ProviderDiscoveryGraphQLType.type.ts
      mappers/
        toProviderGraphQLType.ts
        toProviderDiscoveryGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/**
 * Aggregate root for `Provider` invariants; persistence ignorant and reconstituted by repositories.
 * Constructor fields:
 * - `id` is the strongly typed aggregate identifier.
 * - Other constructor fields are the scalar/value-object state listed in the Persistence Model.
 * - Timestamps preserve creation/update history from persistence.
 */
class Provider extends AggregateRoot<ProviderId> {
  /**
   * Creates a new `Provider` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Provider;

  /**
   * Rehydrates `Provider` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Provider;

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
 * Strongly typed identifier for Provider; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class ProviderId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): ProviderId;
}

/**
 * Base domain error for violated Provider invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class ProviderInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Provider after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ProviderCreatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Provider after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ProviderProfileUpdatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Provider after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ProviderVerifiedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Provider after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ProviderRatingSnapshotUpdatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Provider; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IProviderRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `ProviderMapper.toDomain(row)` when present.
   */
  findById(id: ProviderId): Promise<Provider | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `ProviderMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Provider`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Provider): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the CreateProvider use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreateProviderCommand extends Command<ProviderId> {
  /**
   * Captures all input required by CreateProviderHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CreateProviderPayload);
}

/**
 * Handles `CreateProviderCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` loads and saves `Provider` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Provider` state through `providerRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Provider.createProvider(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `providerRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CreateProviderCommand)
class CreateProviderHandler implements ICommandHandler<CreateProviderCommand> {
  /**
   * Executes `CreateProviderCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Provider` state with `providerRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Provider` domain method for `CreateProvider` if not declared above.
   * 4. Persist with `providerRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CreateProviderCommand): Promise<ProviderId>;
}

/**
 * Command input for the UpdateProviderProfile use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class UpdateProviderProfileCommand extends Command<void> {
  /**
   * Captures all input required by UpdateProviderProfileHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: UpdateProviderProfilePayload);
}

/**
 * Handles `UpdateProviderProfileCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` loads and saves `Provider` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Provider` state through `providerRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Provider.updateProviderProfile(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `providerRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(UpdateProviderProfileCommand)
class UpdateProviderProfileHandler implements ICommandHandler<UpdateProviderProfileCommand> {
  /**
   * Executes `UpdateProviderProfileCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Provider` state with `providerRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Provider` domain method for `UpdateProviderProfile` if not declared above.
   * 4. Persist with `providerRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: UpdateProviderProfileCommand): Promise<void>;
}

/**
 * Command input for the VerifyProvider use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class VerifyProviderCommand extends Command<void> {
  /**
   * Captures all input required by VerifyProviderHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: VerifyProviderPayload);
}

/**
 * Handles `VerifyProviderCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` loads and saves `Provider` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Provider` state through `providerRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Provider.verifyProvider(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `providerRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(VerifyProviderCommand)
class VerifyProviderHandler implements ICommandHandler<VerifyProviderCommand> {
  /**
   * Executes `VerifyProviderCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Provider` state with `providerRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Provider` domain method for `VerifyProvider` if not declared above.
   * 4. Persist with `providerRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: VerifyProviderCommand): Promise<void>;
}

/**
 * Command input for the UpdateProviderRatingSnapshot use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class UpdateProviderRatingSnapshotCommand extends Command<void> {
  /**
   * Captures all input required by UpdateProviderRatingSnapshotHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: UpdateProviderRatingSnapshotPayload);
}

/**
 * Handles `UpdateProviderRatingSnapshotCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` loads and saves `Provider` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Provider` state through `providerRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Provider.updateProviderRatingSnapshot(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `providerRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(UpdateProviderRatingSnapshotCommand)
class UpdateProviderRatingSnapshotHandler implements ICommandHandler<UpdateProviderRatingSnapshotCommand> {
  /**
   * Executes `UpdateProviderRatingSnapshotCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Provider` state with `providerRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Provider` domain method for `UpdateProviderRatingSnapshot` if not declared above.
   * 4. Persist with `providerRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: UpdateProviderRatingSnapshotCommand): Promise<void>;
}

/**
 * Query input for GetProvider.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetProviderQuery extends Query<ProviderDTO> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetProviderPayload);
}

/**
 * Handles `GetProviderQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` reads `Provider` persistence state.
 * - `ProviderMapper: ProviderMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `providerRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ProviderMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetProviderQuery)
class GetProviderHandler implements IQueryHandler<GetProviderQuery> {
  /**
   * Executes `GetProviderQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `providerRepository` or the module read model.
   * 3. Map rows with `ProviderMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetProviderQuery): Promise<ProviderDTO>;
}

/**
 * Query input for DiscoverProviders.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class DiscoverProvidersQuery extends Query<ProviderDiscoveryDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: DiscoverProvidersPayload);
}

/**
 * Handles `DiscoverProvidersQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` reads `Provider` persistence state.
 * - `ProviderMapper: ProviderMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `providerRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ProviderMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(DiscoverProvidersQuery)
class DiscoverProvidersHandler implements IQueryHandler<DiscoverProvidersQuery> {
  /**
   * Executes `DiscoverProvidersQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `providerRepository` or the module read model.
   * 3. Map rows with `ProviderMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: DiscoverProvidersQuery): Promise<ProviderDiscoveryDTO[]>;
}

/**
 * Query input for SearchProviders.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class SearchProvidersQuery extends Query<ProviderDiscoveryDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: SearchProvidersPayload);
}

/**
 * Handles `SearchProvidersQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `providerRepository: IProviderRepository` reads `Provider` persistence state.
 * - `ProviderMapper: ProviderMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `providerRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ProviderMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(SearchProvidersQuery)
class SearchProvidersHandler implements IQueryHandler<SearchProvidersQuery> {
  /**
   * Executes `SearchProvidersQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `providerRepository` or the module read model.
   * 3. Map rows with `ProviderMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: SearchProvidersQuery): Promise<ProviderDiscoveryDTO[]>;
}

/**
 * Event handler for `RatingCreatedEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `RatingCreatedEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(RatingCreatedEvent)
class OnRatingCreatedUpdateProviderRatingHandler implements IEventHandler<RatingCreatedEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: RatingCreatedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IProviderRepository; maps rows through ProviderMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaProviderRepository implements IProviderRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: ProviderId): Promise<Provider | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Provider): Promise<void>;
}

/**
 * Injectable mapper for `Provider`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Provider.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class ProviderMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Provider;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Provider): unknown;
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
class ProviderResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for ProviderGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ProviderGraphQLTypeShape = Omit<ProviderDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ProviderGraphQLType implements ProviderGraphQLTypeShape {
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
function toProviderGraphQLType(dto: ProviderDTO): ProviderGraphQLType;

/**
 * GraphQL shape for ProviderDiscoveryGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ProviderDiscoveryGraphQLTypeShape = Omit<ProviderDiscoveryDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ProviderDiscoveryGraphQLType implements ProviderDiscoveryGraphQLTypeShape {
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
function toProviderDiscoveryGraphQLType(dto: ProviderDiscoveryDTO): ProviderDiscoveryGraphQLType;

```

## EIP Patterns Applied

- **Materialized View**: Provider keeps a rating and discovery snapshot updated from RatingCreatedEvent for efficient provider search. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Discovery queries route by trusted, new, popular, suggested, and search criteria without changing Provider aggregate rules. Status: fully specced with concrete signatures in the Implementation Spec.
