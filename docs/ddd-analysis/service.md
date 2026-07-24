# Service - DDD & EIP Analysis

## Current Responsibility

Service owns the catalog of service categories and services used to classify errands and provider skills. Errands reference service IDs for history; Service does not own errand lifecycle.

## Domain Model

`ServiceCategoryAggregate` is the aggregate root and `ServiceId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

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

/** Aggregate root for Service invariants; persistence ignorant and reconstituted by repositories. */
class ServiceCategoryAggregate extends AggregateRoot<ServiceId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): ServiceCategoryAggregate;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): ServiceCategoryAggregate;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for ServiceCategoryAggregate; prevents cross-aggregate ID mix-ups. */
class ServiceId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): ServiceId;
}

/** Base domain error for violated Service invariants. */
class ServiceCategoryAggregateInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by ServiceCategoryAggregate after its state transition is persisted. */
class ServiceCatalogRefreshedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ServiceId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for ServiceCategoryAggregate; domain/application depend on this contract, not Prisma. */
interface IServiceRepository {
  /** Loads an aggregate by ID. */
  findById(id: ServiceId): Promise<ServiceCategoryAggregate | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: ServiceCategoryAggregate): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the RefreshServiceCatalog use case. */
class RefreshServiceCatalogCommand extends Command<void> {
  /** Captures all input required by RefreshServiceCatalogHandler. */
  constructor(public readonly payload: RefreshServiceCatalogPayload);
}

/** Handles RefreshServiceCatalogCommand through the NestJS CommandBus. */
@CommandHandler(RefreshServiceCatalogCommand)
class RefreshServiceCatalogHandler implements ICommandHandler<RefreshServiceCatalogCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RefreshServiceCatalogCommand): Promise<void>;
}

/** Query input for GetServiceCategories. */
class GetServiceCategoriesQuery extends Query<ServiceCategoryDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetServiceCategoriesPayload);
}

/** Handles GetServiceCategoriesQuery through the NestJS QueryBus. */
@QueryHandler(GetServiceCategoriesQuery)
class GetServiceCategoriesHandler implements IQueryHandler<GetServiceCategoriesQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetServiceCategoriesQuery): Promise<ServiceCategoryDTO[]>;
}

/** Query input for GetServicesByCategory. */
class GetServicesByCategoryQuery extends Query<ServiceDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetServicesByCategoryPayload);
}

/** Handles GetServicesByCategoryQuery through the NestJS QueryBus. */
@QueryHandler(GetServicesByCategoryQuery)
class GetServicesByCategoryHandler implements IQueryHandler<GetServicesByCategoryQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetServicesByCategoryQuery): Promise<ServiceDTO[]>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IServiceRepository; maps rows through ServiceMapper. */
@Injectable()
class PrismaServiceCategoryAggregateRepository implements IServiceRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: ServiceId): Promise<ServiceCategoryAggregate | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: ServiceCategoryAggregate): Promise<void>;
}

/** Injectable mapper for ServiceCategoryAggregate; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class ServiceMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): ServiceCategoryAggregate;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: ServiceCategoryAggregate): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class ServiceResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for ServiceCategoryGraphQLType; separate from application DTOs. */
type ServiceCategoryGraphQLTypeShape = Omit<ServiceCategoryDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ServiceCategoryGraphQLType implements ServiceCategoryGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toServiceCategoryGraphQLType(dto: ServiceCategoryDTO): ServiceCategoryGraphQLType;

/** GraphQL shape for ServiceGraphQLType; separate from application DTOs. */
type ServiceGraphQLTypeShape = Omit<ServiceDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ServiceGraphQLType implements ServiceGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toServiceGraphQLType(dto: ServiceDTO): ServiceGraphQLType;

```

## EIP Patterns Applied

- **Reference Data**: The catalog is a bounded reference-data source used by Errands and Provider. Status: fully specced with concrete signatures in the Implementation Spec.
- **Materialized View**: Category/service GraphQL types are read models projected from catalog records. Status: fully specced with concrete signatures in the Implementation Spec.
