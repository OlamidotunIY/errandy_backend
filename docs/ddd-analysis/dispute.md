# Dispute - DDD & EIP Analysis

## Current Responsibility

Dispute owns conflict records raised against errands and the decision that resolves them. Escrow performs money movement; Dispute records evidence, status, resolution, and the chosen outcome command.

## Domain Model

`Dispute` is the aggregate root and `DisputeId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/dispute/
  domain/
    entities/
      Dispute.ts
    value-objects/
      DisputeId.ts
    errors/
      DisputeInvariantError.ts
    events/
      DisputeOpenedEvent.ts
      DisputeResolvedEvent.ts
    repositories/
      IDisputeRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      OpenDispute/
        OpenDisputeCommand.ts
        OpenDisputeHandler.ts
      ResolveDispute/
        ResolveDisputeCommand.ts
        ResolveDisputeHandler.ts
    queries/
      GetDispute/
        GetDisputeQuery.ts
        GetDisputeHandler.ts
      ListErrandDisputes/
        ListErrandDisputesQuery.ts
        ListErrandDisputesHandler.ts
    sagas/
      DisputeResolutionSaga.ts
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaDisputeRepository.ts
    mappers/
      DisputeMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      DisputeResolver.ts
    graphql/
      DisputeGraphQLType.type.ts
      mappers/
        toDisputeGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Dispute invariants; persistence ignorant and reconstituted by repositories. */
class Dispute extends AggregateRoot<DisputeId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Dispute;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Dispute;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Dispute; prevents cross-aggregate ID mix-ups. */
class DisputeId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): DisputeId;
}

/** Base domain error for violated Dispute invariants. */
class DisputeInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Dispute after its state transition is persisted. */
class DisputeOpenedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: DisputeId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Dispute after its state transition is persisted. */
class DisputeResolvedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: DisputeId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Dispute; domain/application depend on this contract, not Prisma. */
interface IDisputeRepository {
  /** Loads an aggregate by ID. */
  findById(id: DisputeId): Promise<Dispute | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Dispute): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the OpenDispute use case. */
class OpenDisputeCommand extends Command<DisputeId> {
  /** Captures all input required by OpenDisputeHandler. */
  constructor(public readonly payload: OpenDisputePayload);
}

/** Handles OpenDisputeCommand through the NestJS CommandBus. */
@CommandHandler(OpenDisputeCommand)
class OpenDisputeHandler implements ICommandHandler<OpenDisputeCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: OpenDisputeCommand): Promise<DisputeId>;
}

/** Command input for the ResolveDispute use case. */
class ResolveDisputeCommand extends Command<void> {
  /** Captures all input required by ResolveDisputeHandler. */
  constructor(public readonly payload: ResolveDisputePayload);
}

/** Handles ResolveDisputeCommand through the NestJS CommandBus. */
@CommandHandler(ResolveDisputeCommand)
class ResolveDisputeHandler implements ICommandHandler<ResolveDisputeCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: ResolveDisputeCommand): Promise<void>;
}

/** Query input for GetDispute. */
class GetDisputeQuery extends Query<DisputeDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetDisputePayload);
}

/** Handles GetDisputeQuery through the NestJS QueryBus. */
@QueryHandler(GetDisputeQuery)
class GetDisputeHandler implements IQueryHandler<GetDisputeQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetDisputeQuery): Promise<DisputeDTO | null>;
}

/** Query input for ListErrandDisputes. */
class ListErrandDisputesQuery extends Query<DisputeDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: ListErrandDisputesPayload);
}

/** Handles ListErrandDisputesQuery through the NestJS QueryBus. */
@QueryHandler(ListErrandDisputesQuery)
class ListErrandDisputesHandler implements IQueryHandler<ListErrandDisputesQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: ListErrandDisputesQuery): Promise<DisputeDTO[]>;
}

/** Process manager that reacts to DisputeResolvedEvent and dispatches follow-up commands through CommandBus. */
class DisputeResolutionSaga {
  /** Creates the saga with CommandBus, EventBus, and logger dependencies. */
  constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus);

  /** Handles the triggering event and dispatches commands with commandBus.execute(new XCommand(...)). */
  async handle(event: DisputeResolvedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IDisputeRepository; maps rows through DisputeMapper. */
@Injectable()
class PrismaDisputeRepository implements IDisputeRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: DisputeId): Promise<Dispute | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Dispute): Promise<void>;
}

/** Injectable mapper for Dispute; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class DisputeMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Dispute;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Dispute): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class DisputeResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for DisputeGraphQLType; separate from application DTOs. */
type DisputeGraphQLTypeShape = Omit<DisputeDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class DisputeGraphQLType implements DisputeGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toDisputeGraphQLType(dto: DisputeDTO): DisputeGraphQLType;

```

## EIP Patterns Applied

- **Saga / Process Manager**: DisputeResolutionSaga routes resolved disputes to Escrow release or refund commands. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Resolution outcome selects the downstream command: ReleaseEscrowCommand or RefundEscrowCommand. Status: fully specced with concrete signatures in the Implementation Spec.
