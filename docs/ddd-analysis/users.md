# Users - DDD & EIP Analysis

## Current Responsibility

Users owns platform identity profile data: names, contact fields, avatar metadata, onboarding progress, and the active address pointer. Address rows remain owned by Address; Users only stores the selected AddressId and clears it through a command when an address is removed.

## Domain Model

`User` is the aggregate root and `UserId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/users/
  domain/
    entities/
      User.ts
    value-objects/
      UserId.ts
    errors/
      UserInvariantError.ts
    events/
      UserProfileUpdatedEvent.ts
      ActiveAddressChangedEvent.ts
      ActiveAddressClearedEvent.ts
    repositories/
      IUserRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      UpdateUserProfile/
        UpdateUserProfileCommand.ts
        UpdateUserProfileHandler.ts
      SetActiveAddress/
        SetActiveAddressCommand.ts
        SetActiveAddressHandler.ts
      ClearActiveAddress/
        ClearActiveAddressCommand.ts
        ClearActiveAddressHandler.ts
    queries/
      GetUserProfile/
        GetUserProfileQuery.ts
        GetUserProfileHandler.ts
      FindUserByEmail/
        FindUserByEmailQuery.ts
        FindUserByEmailHandler.ts
    sagas/
      (none)
    event-handlers/
      OnAddressDeletedClearActiveAddressHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaUserRepository.ts
    mappers/
      UserMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      UsersResolver.ts
    graphql/
      UserGraphQLType.type.ts
      mappers/
        toUserGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Users invariants; persistence ignorant and reconstituted by repositories. */
class User extends AggregateRoot<UserId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): User;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): User;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for User; prevents cross-aggregate ID mix-ups. */
class UserId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): UserId;
}

/** Base domain error for violated Users invariants. */
class UserInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by User after its state transition is persisted. */
class UserProfileUpdatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: UserId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by User after its state transition is persisted. */
class ActiveAddressChangedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: UserId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by User after its state transition is persisted. */
class ActiveAddressClearedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: UserId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for User; domain/application depend on this contract, not Prisma. */
interface IUserRepository {
  /** Loads an aggregate by ID. */
  findById(id: UserId): Promise<User | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: User): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the UpdateUserProfile use case. */
class UpdateUserProfileCommand extends Command<void> {
  /** Captures all input required by UpdateUserProfileHandler. */
  constructor(public readonly payload: UpdateUserProfilePayload);
}

/** Handles UpdateUserProfileCommand through the NestJS CommandBus. */
@CommandHandler(UpdateUserProfileCommand)
class UpdateUserProfileHandler implements ICommandHandler<UpdateUserProfileCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: UpdateUserProfileCommand): Promise<void>;
}

/** Command input for the SetActiveAddress use case. */
class SetActiveAddressCommand extends Command<void> {
  /** Captures all input required by SetActiveAddressHandler. */
  constructor(public readonly payload: SetActiveAddressPayload);
}

/** Handles SetActiveAddressCommand through the NestJS CommandBus. */
@CommandHandler(SetActiveAddressCommand)
class SetActiveAddressHandler implements ICommandHandler<SetActiveAddressCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: SetActiveAddressCommand): Promise<void>;
}

/** Command input for the ClearActiveAddress use case. */
class ClearActiveAddressCommand extends Command<void> {
  /** Captures all input required by ClearActiveAddressHandler. */
  constructor(public readonly payload: ClearActiveAddressPayload);
}

/** Handles ClearActiveAddressCommand through the NestJS CommandBus. */
@CommandHandler(ClearActiveAddressCommand)
class ClearActiveAddressHandler implements ICommandHandler<ClearActiveAddressCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: ClearActiveAddressCommand): Promise<void>;
}

/** Query input for GetUserProfile. */
class GetUserProfileQuery extends Query<UserDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetUserProfilePayload);
}

/** Handles GetUserProfileQuery through the NestJS QueryBus. */
@QueryHandler(GetUserProfileQuery)
class GetUserProfileHandler implements IQueryHandler<GetUserProfileQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetUserProfileQuery): Promise<UserDTO>;
}

/** Query input for FindUserByEmail. */
class FindUserByEmailQuery extends Query<UserDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: FindUserByEmailPayload);
}

/** Handles FindUserByEmailQuery through the NestJS QueryBus. */
@QueryHandler(FindUserByEmailQuery)
class FindUserByEmailHandler implements IQueryHandler<FindUserByEmailQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: FindUserByEmailQuery): Promise<UserDTO | null>;
}

/** Event handler for AddressDeletedEvent; uses buses rather than handler classes. */
@EventsHandler(AddressDeletedEvent)
class OnAddressDeletedClearActiveAddressHandler implements IEventHandler<AddressDeletedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: AddressDeletedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IUserRepository; maps rows through UserMapper. */
@Injectable()
class PrismaUserRepository implements IUserRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: UserId): Promise<User | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: User): Promise<void>;
}

/** Injectable mapper for User; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class UserMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): User;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: User): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class UsersResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for UserGraphQLType; separate from application DTOs. */
type UserGraphQLTypeShape = Omit<UserDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class UserGraphQLType implements UserGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toUserGraphQLType(dto: UserDTO): UserGraphQLType;

```

## EIP Patterns Applied

- **Idempotent Receiver**: Email and phone updates are protected by database uniqueness and command-level identity checks before persistence. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: AddressDeletedEvent is routed only when the deleted AddressId equals the user activeAddressId. Status: fully specced with concrete signatures in the Implementation Spec.
