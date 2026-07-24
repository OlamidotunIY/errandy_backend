# Organization - DDD & EIP Analysis

## Current Responsibility

Organization owns team profiles and membership lifecycle for grouped clients or providers. Membership is part of the Organization aggregate and all member changes go through organization commands.

## Domain Model

`Organization` is the aggregate root and `OrganizationId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/organization/
  domain/
    entities/
      Organization.ts
    value-objects/
      OrganizationId.ts
    errors/
      OrganizationInvariantError.ts
    events/
      OrganizationCreatedEvent.ts
      MemberAddedToOrganizationEvent.ts
      MemberRemovedFromOrganizationEvent.ts
    repositories/
      IOrganizationRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      CreateOrganization/
        CreateOrganizationCommand.ts
        CreateOrganizationHandler.ts
      AddOrganizationMember/
        AddOrganizationMemberCommand.ts
        AddOrganizationMemberHandler.ts
      RemoveOrganizationMember/
        RemoveOrganizationMemberCommand.ts
        RemoveOrganizationMemberHandler.ts
    queries/
      GetMyOrganization/
        GetMyOrganizationQuery.ts
        GetMyOrganizationHandler.ts
      ListOrganizationMembers/
        ListOrganizationMembersQuery.ts
        ListOrganizationMembersHandler.ts
    sagas/
      (none)
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaOrganizationRepository.ts
    mappers/
      OrganizationMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      OrganizationResolver.ts
    graphql/
      OrganizationGraphQLType.type.ts
      OrganizationMemberGraphQLType.type.ts
      mappers/
        toOrganizationGraphQLType.ts
        toOrganizationMemberGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Organization invariants; persistence ignorant and reconstituted by repositories. */
class Organization extends AggregateRoot<OrganizationId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Organization;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Organization;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Organization; prevents cross-aggregate ID mix-ups. */
class OrganizationId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): OrganizationId;
}

/** Base domain error for violated Organization invariants. */
class OrganizationInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Organization after its state transition is persisted. */
class OrganizationCreatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: OrganizationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Organization after its state transition is persisted. */
class MemberAddedToOrganizationEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: OrganizationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Organization after its state transition is persisted. */
class MemberRemovedFromOrganizationEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: OrganizationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Organization; domain/application depend on this contract, not Prisma. */
interface IOrganizationRepository {
  /** Loads an aggregate by ID. */
  findById(id: OrganizationId): Promise<Organization | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Organization): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the CreateOrganization use case. */
class CreateOrganizationCommand extends Command<OrganizationId> {
  /** Captures all input required by CreateOrganizationHandler. */
  constructor(public readonly payload: CreateOrganizationPayload);
}

/** Handles CreateOrganizationCommand through the NestJS CommandBus. */
@CommandHandler(CreateOrganizationCommand)
class CreateOrganizationHandler implements ICommandHandler<CreateOrganizationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CreateOrganizationCommand): Promise<OrganizationId>;
}

/** Command input for the AddOrganizationMember use case. */
class AddOrganizationMemberCommand extends Command<void> {
  /** Captures all input required by AddOrganizationMemberHandler. */
  constructor(public readonly payload: AddOrganizationMemberPayload);
}

/** Handles AddOrganizationMemberCommand through the NestJS CommandBus. */
@CommandHandler(AddOrganizationMemberCommand)
class AddOrganizationMemberHandler implements ICommandHandler<AddOrganizationMemberCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AddOrganizationMemberCommand): Promise<void>;
}

/** Command input for the RemoveOrganizationMember use case. */
class RemoveOrganizationMemberCommand extends Command<void> {
  /** Captures all input required by RemoveOrganizationMemberHandler. */
  constructor(public readonly payload: RemoveOrganizationMemberPayload);
}

/** Handles RemoveOrganizationMemberCommand through the NestJS CommandBus. */
@CommandHandler(RemoveOrganizationMemberCommand)
class RemoveOrganizationMemberHandler implements ICommandHandler<RemoveOrganizationMemberCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RemoveOrganizationMemberCommand): Promise<void>;
}

/** Query input for GetMyOrganization. */
class GetMyOrganizationQuery extends Query<OrganizationDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetMyOrganizationPayload);
}

/** Handles GetMyOrganizationQuery through the NestJS QueryBus. */
@QueryHandler(GetMyOrganizationQuery)
class GetMyOrganizationHandler implements IQueryHandler<GetMyOrganizationQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetMyOrganizationQuery): Promise<OrganizationDTO | null>;
}

/** Query input for ListOrganizationMembers. */
class ListOrganizationMembersQuery extends Query<OrganizationMemberDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: ListOrganizationMembersPayload);
}

/** Handles ListOrganizationMembersQuery through the NestJS QueryBus. */
@QueryHandler(ListOrganizationMembersQuery)
class ListOrganizationMembersHandler implements IQueryHandler<ListOrganizationMembersQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: ListOrganizationMembersQuery): Promise<OrganizationMemberDTO[]>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IOrganizationRepository; maps rows through OrganizationMapper. */
@Injectable()
class PrismaOrganizationRepository implements IOrganizationRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: OrganizationId): Promise<Organization | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Organization): Promise<void>;
}

/** Injectable mapper for Organization; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class OrganizationMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Organization;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Organization): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class OrganizationResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for OrganizationGraphQLType; separate from application DTOs. */
type OrganizationGraphQLTypeShape = Omit<OrganizationDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class OrganizationGraphQLType implements OrganizationGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toOrganizationGraphQLType(dto: OrganizationDTO): OrganizationGraphQLType;

/** GraphQL shape for OrganizationMemberGraphQLType; separate from application DTOs. */
type OrganizationMemberGraphQLTypeShape = Omit<OrganizationMemberDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class OrganizationMemberGraphQLType implements OrganizationMemberGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toOrganizationMemberGraphQLType(dto: OrganizationMemberDTO): OrganizationMemberGraphQLType;

```

## EIP Patterns Applied

- **Aggregate Boundary**: Organization controls membership consistency and prevents external modules from writing OrgMember rows directly. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: Membership changes emit events for audit and notification handlers. Status: fully specced with concrete signatures in the Implementation Spec.
