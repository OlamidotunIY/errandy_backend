# Auth - DDD & EIP Analysis

## Current Responsibility

Auth owns authentication identities, sessions, login events, and sign-up completion integration with Users. The identity boundary records provider/email/session facts while profile data remains in Users.

## Domain Model

`AuthIdentity` is the aggregate root and `AuthIdentityId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/auth/
  domain/
    entities/
      AuthIdentity.ts
    value-objects/
      AuthIdentityId.ts
    errors/
      AuthIdentityInvariantError.ts
    events/
      UserRegisteredEvent.ts
      UserLoggedInEvent.ts
      SessionRevokedEvent.ts
    repositories/
      IAuthRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      HandleSignUpComplete/
        HandleSignUpCompleteCommand.ts
        HandleSignUpCompleteHandler.ts
      HandleLoginSucceeded/
        HandleLoginSucceededCommand.ts
        HandleLoginSucceededHandler.ts
      RevokeSession/
        RevokeSessionCommand.ts
        RevokeSessionHandler.ts
    queries/
      GetCurrentSession/
        GetCurrentSessionQuery.ts
        GetCurrentSessionHandler.ts
    sagas/
      (none)
    event-handlers/
      OnUserDeletedRevokeSessionsHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaAuthIdentityRepository.ts
    mappers/
      AuthMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      AuthResolver.ts
    graphql/
      AuthSessionGraphQLType.type.ts
      mappers/
        toAuthSessionGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Auth invariants; persistence ignorant and reconstituted by repositories. */
class AuthIdentity extends AggregateRoot<AuthIdentityId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): AuthIdentity;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): AuthIdentity;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for AuthIdentity; prevents cross-aggregate ID mix-ups. */
class AuthIdentityId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): AuthIdentityId;
}

/** Base domain error for violated Auth invariants. */
class AuthIdentityInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by AuthIdentity after its state transition is persisted. */
class UserRegisteredEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AuthIdentityId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by AuthIdentity after its state transition is persisted. */
class UserLoggedInEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AuthIdentityId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by AuthIdentity after its state transition is persisted. */
class SessionRevokedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AuthIdentityId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for AuthIdentity; domain/application depend on this contract, not Prisma. */
interface IAuthRepository {
  /** Loads an aggregate by ID. */
  findById(id: AuthIdentityId): Promise<AuthIdentity | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: AuthIdentity): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the HandleSignUpComplete use case. */
class HandleSignUpCompleteCommand extends Command<UserId> {
  /** Captures all input required by HandleSignUpCompleteHandler. */
  constructor(public readonly payload: HandleSignUpCompletePayload);
}

/** Handles HandleSignUpCompleteCommand through the NestJS CommandBus. */
@CommandHandler(HandleSignUpCompleteCommand)
class HandleSignUpCompleteHandler implements ICommandHandler<HandleSignUpCompleteCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: HandleSignUpCompleteCommand): Promise<UserId>;
}

/** Command input for the HandleLoginSucceeded use case. */
class HandleLoginSucceededCommand extends Command<void> {
  /** Captures all input required by HandleLoginSucceededHandler. */
  constructor(public readonly payload: HandleLoginSucceededPayload);
}

/** Handles HandleLoginSucceededCommand through the NestJS CommandBus. */
@CommandHandler(HandleLoginSucceededCommand)
class HandleLoginSucceededHandler implements ICommandHandler<HandleLoginSucceededCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: HandleLoginSucceededCommand): Promise<void>;
}

/** Command input for the RevokeSession use case. */
class RevokeSessionCommand extends Command<void> {
  /** Captures all input required by RevokeSessionHandler. */
  constructor(public readonly payload: RevokeSessionPayload);
}

/** Handles RevokeSessionCommand through the NestJS CommandBus. */
@CommandHandler(RevokeSessionCommand)
class RevokeSessionHandler implements ICommandHandler<RevokeSessionCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RevokeSessionCommand): Promise<void>;
}

/** Query input for GetCurrentSession. */
class GetCurrentSessionQuery extends Query<AuthSessionDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetCurrentSessionPayload);
}

/** Handles GetCurrentSessionQuery through the NestJS QueryBus. */
@QueryHandler(GetCurrentSessionQuery)
class GetCurrentSessionHandler implements IQueryHandler<GetCurrentSessionQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetCurrentSessionQuery): Promise<AuthSessionDTO | null>;
}

/** Event handler for UserDeletedEvent; uses buses rather than handler classes. */
@EventsHandler(UserDeletedEvent)
class OnUserDeletedRevokeSessionsHandler implements IEventHandler<UserDeletedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: UserDeletedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IAuthRepository; maps rows through AuthMapper. */
@Injectable()
class PrismaAuthIdentityRepository implements IAuthRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: AuthIdentityId): Promise<AuthIdentity | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: AuthIdentity): Promise<void>;
}

/** Injectable mapper for AuthIdentity; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class AuthMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): AuthIdentity;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: AuthIdentity): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class AuthResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for AuthSessionGraphQLType; separate from application DTOs. */
type AuthSessionGraphQLTypeShape = Omit<AuthSessionDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class AuthSessionGraphQLType implements AuthSessionGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toAuthSessionGraphQLType(dto: AuthSessionDTO): AuthSessionGraphQLType;

```

## EIP Patterns Applied

- **Idempotent Receiver**: Sign-up completion keys by provider identity/email so repeated auth callbacks resolve to one user identity. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: UserRegisteredEvent and UserLoggedInEvent capture auth milestones for audit and notifications. Status: fully specced with concrete signatures in the Implementation Spec.
