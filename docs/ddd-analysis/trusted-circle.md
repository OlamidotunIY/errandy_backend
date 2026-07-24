# Trusted Circle - DDD & EIP Analysis

## Current Responsibility

Trusted Circle owns a client-curated set of preferred providers. It supports provider trust signals for discovery without merging Client and Provider aggregate state.

## Domain Model

`TrustedCircle` is the aggregate root and `TrustedCircleId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/trusted-circle/
  domain/
    entities/
      TrustedCircle.ts
    value-objects/
      TrustedCircleId.ts
    errors/
      TrustedCircleInvariantError.ts
    events/
      ProviderAddedToCircleEvent.ts
      ProviderRemovedFromCircleEvent.ts
      TrustedCircleSharedEvent.ts
    repositories/
      ITrustedCircleRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      AddToTrustedCircle/
        AddToTrustedCircleCommand.ts
        AddToTrustedCircleHandler.ts
      RemoveFromTrustedCircle/
        RemoveFromTrustedCircleCommand.ts
        RemoveFromTrustedCircleHandler.ts
      ShareTrustedCircle/
        ShareTrustedCircleCommand.ts
        ShareTrustedCircleHandler.ts
    queries/
      GetTrustedCircle/
        GetTrustedCircleQuery.ts
        GetTrustedCircleHandler.ts
    sagas/
      (none)
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaTrustedCircleRepository.ts
    mappers/
      TrustedCircleMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      TrustedCircleResolver.ts
    graphql/
      TrustedCircleGraphQLType.type.ts
      TrustedCircleMemberGraphQLType.type.ts
      mappers/
        toTrustedCircleGraphQLType.ts
        toTrustedCircleMemberGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Trusted Circle invariants; persistence ignorant and reconstituted by repositories. */
class TrustedCircle extends AggregateRoot<TrustedCircleId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): TrustedCircle;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): TrustedCircle;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for TrustedCircle; prevents cross-aggregate ID mix-ups. */
class TrustedCircleId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): TrustedCircleId;
}

/** Base domain error for violated Trusted Circle invariants. */
class TrustedCircleInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by TrustedCircle after its state transition is persisted. */
class ProviderAddedToCircleEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: TrustedCircleId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by TrustedCircle after its state transition is persisted. */
class ProviderRemovedFromCircleEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: TrustedCircleId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by TrustedCircle after its state transition is persisted. */
class TrustedCircleSharedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: TrustedCircleId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for TrustedCircle; domain/application depend on this contract, not Prisma. */
interface ITrustedCircleRepository {
  /** Loads an aggregate by ID. */
  findById(id: TrustedCircleId): Promise<TrustedCircle | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: TrustedCircle): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the AddToTrustedCircle use case. */
class AddToTrustedCircleCommand extends Command<void> {
  /** Captures all input required by AddToTrustedCircleHandler. */
  constructor(public readonly payload: AddToTrustedCirclePayload);
}

/** Handles AddToTrustedCircleCommand through the NestJS CommandBus. */
@CommandHandler(AddToTrustedCircleCommand)
class AddToTrustedCircleHandler implements ICommandHandler<AddToTrustedCircleCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AddToTrustedCircleCommand): Promise<void>;
}

/** Command input for the RemoveFromTrustedCircle use case. */
class RemoveFromTrustedCircleCommand extends Command<void> {
  /** Captures all input required by RemoveFromTrustedCircleHandler. */
  constructor(public readonly payload: RemoveFromTrustedCirclePayload);
}

/** Handles RemoveFromTrustedCircleCommand through the NestJS CommandBus. */
@CommandHandler(RemoveFromTrustedCircleCommand)
class RemoveFromTrustedCircleHandler implements ICommandHandler<RemoveFromTrustedCircleCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RemoveFromTrustedCircleCommand): Promise<void>;
}

/** Command input for the ShareTrustedCircle use case. */
class ShareTrustedCircleCommand extends Command<void> {
  /** Captures all input required by ShareTrustedCircleHandler. */
  constructor(public readonly payload: ShareTrustedCirclePayload);
}

/** Handles ShareTrustedCircleCommand through the NestJS CommandBus. */
@CommandHandler(ShareTrustedCircleCommand)
class ShareTrustedCircleHandler implements ICommandHandler<ShareTrustedCircleCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: ShareTrustedCircleCommand): Promise<void>;
}

/** Query input for GetTrustedCircle. */
class GetTrustedCircleQuery extends Query<TrustedCircleDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetTrustedCirclePayload);
}

/** Handles GetTrustedCircleQuery through the NestJS QueryBus. */
@QueryHandler(GetTrustedCircleQuery)
class GetTrustedCircleHandler implements IQueryHandler<GetTrustedCircleQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetTrustedCircleQuery): Promise<TrustedCircleDTO>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of ITrustedCircleRepository; maps rows through TrustedCircleMapper. */
@Injectable()
class PrismaTrustedCircleRepository implements ITrustedCircleRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: TrustedCircleId): Promise<TrustedCircle | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: TrustedCircle): Promise<void>;
}

/** Injectable mapper for TrustedCircle; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class TrustedCircleMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): TrustedCircle;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: TrustedCircle): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class TrustedCircleResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for TrustedCircleGraphQLType; separate from application DTOs. */
type TrustedCircleGraphQLTypeShape = Omit<TrustedCircleDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class TrustedCircleGraphQLType implements TrustedCircleGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toTrustedCircleGraphQLType(dto: TrustedCircleDTO): TrustedCircleGraphQLType;

/** GraphQL shape for TrustedCircleMemberGraphQLType; separate from application DTOs. */
type TrustedCircleMemberGraphQLTypeShape = Omit<TrustedCircleMemberDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class TrustedCircleMemberGraphQLType implements TrustedCircleMemberGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toTrustedCircleMemberGraphQLType(dto: TrustedCircleMemberDTO): TrustedCircleMemberGraphQLType;

```

## EIP Patterns Applied

- **Recipient List**: A trusted circle is an explicit recipient/provider list reused by discovery and sharing flows. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: ProviderAddedToCircleEvent and ProviderRemovedFromCircleEvent update discovery read models. Status: fully specced with concrete signatures in the Implementation Spec.
