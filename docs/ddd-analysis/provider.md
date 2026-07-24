# Provider - DDD & EIP Analysis

## Current Responsibility

Provider owns worker-facing profile state: skills, services, verification state, discovery attributes, and aggregate rating snapshot. Rating remains the source of individual reviews; Provider stores only the query-optimized rating summary.

## Domain Model

`Provider` is the aggregate root and `ProviderId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

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

/** Aggregate root for Provider invariants; persistence ignorant and reconstituted by repositories. */
class Provider extends AggregateRoot<ProviderId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Provider;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Provider;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Provider; prevents cross-aggregate ID mix-ups. */
class ProviderId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): ProviderId;
}

/** Base domain error for violated Provider invariants. */
class ProviderInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Provider after its state transition is persisted. */
class ProviderCreatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Provider after its state transition is persisted. */
class ProviderProfileUpdatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Provider after its state transition is persisted. */
class ProviderVerifiedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Provider after its state transition is persisted. */
class ProviderRatingSnapshotUpdatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ProviderId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Provider; domain/application depend on this contract, not Prisma. */
interface IProviderRepository {
  /** Loads an aggregate by ID. */
  findById(id: ProviderId): Promise<Provider | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Provider): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the CreateProvider use case. */
class CreateProviderCommand extends Command<ProviderId> {
  /** Captures all input required by CreateProviderHandler. */
  constructor(public readonly payload: CreateProviderPayload);
}

/** Handles CreateProviderCommand through the NestJS CommandBus. */
@CommandHandler(CreateProviderCommand)
class CreateProviderHandler implements ICommandHandler<CreateProviderCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CreateProviderCommand): Promise<ProviderId>;
}

/** Command input for the UpdateProviderProfile use case. */
class UpdateProviderProfileCommand extends Command<void> {
  /** Captures all input required by UpdateProviderProfileHandler. */
  constructor(public readonly payload: UpdateProviderProfilePayload);
}

/** Handles UpdateProviderProfileCommand through the NestJS CommandBus. */
@CommandHandler(UpdateProviderProfileCommand)
class UpdateProviderProfileHandler implements ICommandHandler<UpdateProviderProfileCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: UpdateProviderProfileCommand): Promise<void>;
}

/** Command input for the VerifyProvider use case. */
class VerifyProviderCommand extends Command<void> {
  /** Captures all input required by VerifyProviderHandler. */
  constructor(public readonly payload: VerifyProviderPayload);
}

/** Handles VerifyProviderCommand through the NestJS CommandBus. */
@CommandHandler(VerifyProviderCommand)
class VerifyProviderHandler implements ICommandHandler<VerifyProviderCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: VerifyProviderCommand): Promise<void>;
}

/** Command input for the UpdateProviderRatingSnapshot use case. */
class UpdateProviderRatingSnapshotCommand extends Command<void> {
  /** Captures all input required by UpdateProviderRatingSnapshotHandler. */
  constructor(public readonly payload: UpdateProviderRatingSnapshotPayload);
}

/** Handles UpdateProviderRatingSnapshotCommand through the NestJS CommandBus. */
@CommandHandler(UpdateProviderRatingSnapshotCommand)
class UpdateProviderRatingSnapshotHandler implements ICommandHandler<UpdateProviderRatingSnapshotCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: UpdateProviderRatingSnapshotCommand): Promise<void>;
}

/** Query input for GetProvider. */
class GetProviderQuery extends Query<ProviderDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetProviderPayload);
}

/** Handles GetProviderQuery through the NestJS QueryBus. */
@QueryHandler(GetProviderQuery)
class GetProviderHandler implements IQueryHandler<GetProviderQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetProviderQuery): Promise<ProviderDTO>;
}

/** Query input for DiscoverProviders. */
class DiscoverProvidersQuery extends Query<ProviderDiscoveryDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: DiscoverProvidersPayload);
}

/** Handles DiscoverProvidersQuery through the NestJS QueryBus. */
@QueryHandler(DiscoverProvidersQuery)
class DiscoverProvidersHandler implements IQueryHandler<DiscoverProvidersQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: DiscoverProvidersQuery): Promise<ProviderDiscoveryDTO[]>;
}

/** Query input for SearchProviders. */
class SearchProvidersQuery extends Query<ProviderDiscoveryDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: SearchProvidersPayload);
}

/** Handles SearchProvidersQuery through the NestJS QueryBus. */
@QueryHandler(SearchProvidersQuery)
class SearchProvidersHandler implements IQueryHandler<SearchProvidersQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: SearchProvidersQuery): Promise<ProviderDiscoveryDTO[]>;
}

/** Event handler for RatingCreatedEvent; uses buses rather than handler classes. */
@EventsHandler(RatingCreatedEvent)
class OnRatingCreatedUpdateProviderRatingHandler implements IEventHandler<RatingCreatedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: RatingCreatedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IProviderRepository; maps rows through ProviderMapper. */
@Injectable()
class PrismaProviderRepository implements IProviderRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: ProviderId): Promise<Provider | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Provider): Promise<void>;
}

/** Injectable mapper for Provider; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class ProviderMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Provider;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Provider): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class ProviderResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for ProviderGraphQLType; separate from application DTOs. */
type ProviderGraphQLTypeShape = Omit<ProviderDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ProviderGraphQLType implements ProviderGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toProviderGraphQLType(dto: ProviderDTO): ProviderGraphQLType;

/** GraphQL shape for ProviderDiscoveryGraphQLType; separate from application DTOs. */
type ProviderDiscoveryGraphQLTypeShape = Omit<ProviderDiscoveryDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ProviderDiscoveryGraphQLType implements ProviderDiscoveryGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toProviderDiscoveryGraphQLType(dto: ProviderDiscoveryDTO): ProviderDiscoveryGraphQLType;

```

## EIP Patterns Applied

- **Materialized View**: Provider keeps a rating and discovery snapshot updated from RatingCreatedEvent for efficient provider search. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Discovery queries route by trusted, new, popular, suggested, and search criteria without changing Provider aggregate rules. Status: fully specced with concrete signatures in the Implementation Spec.
