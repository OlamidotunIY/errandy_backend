# Service - DDD & EIP Analysis

## Current Responsibility

Service owns the catalog of service categories and services used to classify errands and provider skills. Errands reference service IDs for history; Service does not own errand lifecycle.

## Bounded Context Assessment

Service is a distinct bounded context because it owns catalog categories and services used to classify errands and provider skills. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `ServiceCategoryAggregate` as the aggregate root and `ServiceId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IServiceRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`ServiceCategoryAggregate` is the aggregate root and `ServiceId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model ServiceCategory {
  id String @id @map("_id")
  name String
  slug String
  active Boolean
  sortOrder Int
  createdAt DateTime
  updatedAt DateTime

  @@unique([slug])
}

model Service {
  id String @id @map("_id")
  categoryId String
  name String
  slug String
  active Boolean
  createdAt DateTime
  updatedAt DateTime

  @@unique([slug])
  @@index([categoryId, active])
}
```

Scalar-ID references and cleanup owners:
- `categoryId` references ServiceCategory. Cleanup owner: ServiceCatalogAdminHandler updates services through IServiceRepository only.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([slug])` maps to `GetServiceCategoriesQuery / RefreshServiceCatalogCommand`; domain error: `DuplicateServiceCategoryError`.
- `Service @@index([categoryId, active])` maps to `GetServicesByCategoryQuery`; domain error: `none`.
- `Service @@unique([slug])` maps to `catalog refresh idempotency`; domain error: `DuplicateServiceError`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


## Target Structure

```text
src/service/
  domain/
    entities/
      ServiceCategoryAggregate.ts
    value-objects/
      ServiceId.ts
    errors/
      ServiceCategoryAggregateInvariantError.ts
    events/
      ServiceCatalogRefreshedEvent.ts
    repositories/
      IServiceRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      RefreshServiceCatalog/
        RefreshServiceCatalogCommand.ts
        RefreshServiceCatalogHandler.ts
    queries/
      GetServiceCategories/
        GetServiceCategoriesQuery.ts
        GetServiceCategoriesHandler.ts
      GetServicesByCategory/
        GetServicesByCategoryQuery.ts
        GetServicesByCategoryHandler.ts
    sagas/
      (none)
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaServiceCategoryAggregateRepository.ts
    mappers/
      ServiceMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      ServiceResolver.ts
    graphql/
      ServiceCategoryGraphQLType.type.ts
      ServiceGraphQLType.type.ts
      mappers/
        toServiceCategoryGraphQLType.ts
        toServiceGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/**
 * Aggregate root for Service invariants; persistence ignorant and reconstituted by repositories.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class ServiceCategoryAggregate extends AggregateRoot<ServiceId> {
  /**
   * Creates a new `ServiceCategoryAggregate` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): ServiceCategoryAggregate;

  /**
   * Rehydrates `ServiceCategoryAggregate` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): ServiceCategoryAggregate;

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
 * Strongly typed identifier for ServiceCategoryAggregate; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class ServiceId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): ServiceId;
}

/**
 * Base domain error for violated Service invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class ServiceCategoryAggregateInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by ServiceCategoryAggregate after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ServiceCatalogRefreshedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ServiceId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for ServiceCategoryAggregate; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IServiceRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `ServiceMapper.toDomain(row)` when present.
   */
  findById(id: ServiceId): Promise<ServiceCategoryAggregate | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `ServiceMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `ServiceCategoryAggregate`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: ServiceCategoryAggregate): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the RefreshServiceCatalog use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RefreshServiceCatalogCommand extends Command<void> {
  /**
   * Captures all input required by RefreshServiceCatalogHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: RefreshServiceCatalogPayload);
}

/**
 * Handles `RefreshServiceCatalogCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `serviceRepository: IServiceCategoryAggregateRepository` loads and saves `ServiceCategoryAggregate` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `ServiceCategoryAggregate` state through `serviceRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `ServiceCategoryAggregate.refreshServiceCatalog(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `serviceRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(RefreshServiceCatalogCommand)
class RefreshServiceCatalogHandler implements ICommandHandler<RefreshServiceCatalogCommand> {
  /**
   * Executes `RefreshServiceCatalogCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `ServiceCategoryAggregate` state with `serviceRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `ServiceCategoryAggregate` domain method for `RefreshServiceCatalog` if not declared above.
   * 4. Persist with `serviceRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: RefreshServiceCatalogCommand): Promise<void>;
}

/**
 * Query input for GetServiceCategories.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetServiceCategoriesQuery extends Query<ServiceCategoryDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetServiceCategoriesPayload);
}

/**
 * Handles `GetServiceCategoriesQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `serviceRepository: IServiceCategoryAggregateRepository` reads `ServiceCategoryAggregate` persistence state.
 * - `ServiceMapper: ServiceMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `serviceRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ServiceMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetServiceCategoriesQuery)
class GetServiceCategoriesHandler implements IQueryHandler<GetServiceCategoriesQuery> {
  /**
   * Executes `GetServiceCategoriesQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `serviceRepository` or the module read model.
   * 3. Map rows with `ServiceMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetServiceCategoriesQuery): Promise<ServiceCategoryDTO[]>;
}

/**
 * Query input for GetServicesByCategory.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetServicesByCategoryQuery extends Query<ServiceDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetServicesByCategoryPayload);
}

/**
 * Handles `GetServicesByCategoryQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `serviceRepository: IServiceCategoryAggregateRepository` reads `ServiceCategoryAggregate` persistence state.
 * - `ServiceMapper: ServiceMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `serviceRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ServiceMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetServicesByCategoryQuery)
class GetServicesByCategoryHandler implements IQueryHandler<GetServicesByCategoryQuery> {
  /**
   * Executes `GetServicesByCategoryQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `serviceRepository` or the module read model.
   * 3. Map rows with `ServiceMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetServicesByCategoryQuery): Promise<ServiceDTO[]>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IServiceRepository; maps rows through ServiceMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaServiceCategoryAggregateRepository implements IServiceRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: ServiceId): Promise<ServiceCategoryAggregate | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: ServiceCategoryAggregate): Promise<void>;
}

/**
 * Injectable mapper for `ServiceCategoryAggregate`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `ServiceCategoryAggregate.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class ServiceMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): ServiceCategoryAggregate;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: ServiceCategoryAggregate): unknown;
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
class ServiceResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for ServiceCategoryGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ServiceCategoryGraphQLTypeShape = Omit<ServiceCategoryDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ServiceCategoryGraphQLType implements ServiceCategoryGraphQLTypeShape {
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
function toServiceCategoryGraphQLType(dto: ServiceCategoryDTO): ServiceCategoryGraphQLType;

/**
 * GraphQL shape for ServiceGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ServiceGraphQLTypeShape = Omit<ServiceDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ServiceGraphQLType implements ServiceGraphQLTypeShape {
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
function toServiceGraphQLType(dto: ServiceDTO): ServiceGraphQLType;

```

## EIP Patterns Applied

- **Reference Data**: The catalog is a bounded reference-data source used by Errands and Provider. Status: fully specced with concrete signatures in the Implementation Spec.
- **Materialized View**: Category/service GraphQL types are read models projected from catalog records. Status: fully specced with concrete signatures in the Implementation Spec.
