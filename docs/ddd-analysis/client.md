# Client - DDD & EIP Analysis

## Current Responsibility

Client owns requester profile state and dashboard read concerns. Errand, Wallet, and Rating remain independent; Client exposes a dashboard DTO assembled by query handlers without taking ownership of those aggregates.

## Domain Model

`Client` is the aggregate root and `ClientId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/client/
  domain/
    entities/
      Client.ts
    value-objects/
      ClientId.ts
    errors/
      ClientInvariantError.ts
    events/
      ClientCreatedEvent.ts
      ClientVerifiedEvent.ts
      ClientRatingSnapshotUpdatedEvent.ts
    repositories/
      IClientRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      CreateClient/
        CreateClientCommand.ts
        CreateClientHandler.ts
      VerifyClient/
        VerifyClientCommand.ts
        VerifyClientHandler.ts
      UpdateClientRatingSnapshot/
        UpdateClientRatingSnapshotCommand.ts
        UpdateClientRatingSnapshotHandler.ts
    queries/
      GetClient/
        GetClientQuery.ts
        GetClientHandler.ts
      GetClientDashboard/
        GetClientDashboardQuery.ts
        GetClientDashboardHandler.ts
    sagas/
      (none)
    event-handlers/
      OnRatingCreatedUpdateClientRatingHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaClientRepository.ts
    mappers/
      ClientMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      ClientResolver.ts
    graphql/
      ClientGraphQLType.type.ts
      ClientDashboardGraphQLType.type.ts
      mappers/
        toClientGraphQLType.ts
        toClientDashboardGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Client invariants; persistence ignorant and reconstituted by repositories. */
class Client extends AggregateRoot<ClientId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Client;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Client;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Client; prevents cross-aggregate ID mix-ups. */
class ClientId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): ClientId;
}

/** Base domain error for violated Client invariants. */
class ClientInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Client after its state transition is persisted. */
class ClientCreatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ClientId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Client after its state transition is persisted. */
class ClientVerifiedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ClientId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Client after its state transition is persisted. */
class ClientRatingSnapshotUpdatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ClientId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Client; domain/application depend on this contract, not Prisma. */
interface IClientRepository {
  /** Loads an aggregate by ID. */
  findById(id: ClientId): Promise<Client | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Client): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the CreateClient use case. */
class CreateClientCommand extends Command<ClientId> {
  /** Captures all input required by CreateClientHandler. */
  constructor(public readonly payload: CreateClientPayload);
}

/** Handles CreateClientCommand through the NestJS CommandBus. */
@CommandHandler(CreateClientCommand)
class CreateClientHandler implements ICommandHandler<CreateClientCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CreateClientCommand): Promise<ClientId>;
}

/** Command input for the VerifyClient use case. */
class VerifyClientCommand extends Command<void> {
  /** Captures all input required by VerifyClientHandler. */
  constructor(public readonly payload: VerifyClientPayload);
}

/** Handles VerifyClientCommand through the NestJS CommandBus. */
@CommandHandler(VerifyClientCommand)
class VerifyClientHandler implements ICommandHandler<VerifyClientCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: VerifyClientCommand): Promise<void>;
}

/** Command input for the UpdateClientRatingSnapshot use case. */
class UpdateClientRatingSnapshotCommand extends Command<void> {
  /** Captures all input required by UpdateClientRatingSnapshotHandler. */
  constructor(public readonly payload: UpdateClientRatingSnapshotPayload);
}

/** Handles UpdateClientRatingSnapshotCommand through the NestJS CommandBus. */
@CommandHandler(UpdateClientRatingSnapshotCommand)
class UpdateClientRatingSnapshotHandler implements ICommandHandler<UpdateClientRatingSnapshotCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: UpdateClientRatingSnapshotCommand): Promise<void>;
}

/** Query input for GetClient. */
class GetClientQuery extends Query<ClientDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetClientPayload);
}

/** Handles GetClientQuery through the NestJS QueryBus. */
@QueryHandler(GetClientQuery)
class GetClientHandler implements IQueryHandler<GetClientQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetClientQuery): Promise<ClientDTO>;
}

/** Query input for GetClientDashboard. */
class GetClientDashboardQuery extends Query<ClientDashboardDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetClientDashboardPayload);
}

/** Handles GetClientDashboardQuery through the NestJS QueryBus. */
@QueryHandler(GetClientDashboardQuery)
class GetClientDashboardHandler implements IQueryHandler<GetClientDashboardQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetClientDashboardQuery): Promise<ClientDashboardDTO>;
}

/** Event handler for RatingCreatedEvent; uses buses rather than handler classes. */
@EventsHandler(RatingCreatedEvent)
class OnRatingCreatedUpdateClientRatingHandler implements IEventHandler<RatingCreatedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: RatingCreatedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IClientRepository; maps rows through ClientMapper. */
@Injectable()
class PrismaClientRepository implements IClientRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: ClientId): Promise<Client | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Client): Promise<void>;
}

/** Injectable mapper for Client; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class ClientMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Client;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Client): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class ClientResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for ClientGraphQLType; separate from application DTOs. */
type ClientGraphQLTypeShape = Omit<ClientDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ClientGraphQLType implements ClientGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toClientGraphQLType(dto: ClientDTO): ClientGraphQLType;

/** GraphQL shape for ClientDashboardGraphQLType; separate from application DTOs. */
type ClientDashboardGraphQLTypeShape = Omit<ClientDashboardDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ClientDashboardGraphQLType implements ClientDashboardGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toClientDashboardGraphQLType(dto: ClientDashboardDTO): ClientDashboardGraphQLType;

```

## EIP Patterns Applied

- **Materialized View**: ClientDashboardDTO composes client, errand, wallet, and rating read data without cross-aggregate writes. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event-Carried State Transfer**: RatingCreatedEvent carries enough rating data to update client rating snapshot without querying Rating synchronously. Status: fully specced with concrete signatures in the Implementation Spec.
