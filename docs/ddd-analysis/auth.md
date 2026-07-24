# Auth - DDD & EIP Analysis

## Current Responsibility

Auth owns authentication identities, sessions, login events, and sign-up completion integration with Users. The identity boundary records provider/email/session facts while profile data remains in Users.

## Bounded Context Assessment

Auth is a distinct bounded context because it owns authentication identities, sessions, login events, and sign-up completion integration with Users. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `AuthIdentity` as the aggregate root and `AuthIdentityId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IAuthRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`AuthIdentity` is the aggregate root and `AuthIdentityId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model AuthIdentity {
  id String @id @map("_id")
  userId String
  provider String
  providerAccountId String?
  email String
  passwordHash String?
  createdAt DateTime
  updatedAt DateTime

  @@unique([email])
  @@unique([provider, providerAccountId])
}

model AuthSession {
  id String @id @map("_id")
  userId String
  token String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime

  @@unique([token])
  @@index([userId])
}
```

Scalar-ID references and cleanup owners:
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler revokes sessions and identities through Auth commands.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([email])` maps to `findIdentityByEmail / HandleSignUpCompleteCommand`; domain error: `AuthIdentityAlreadyExistsError`.
- `@@unique([provider, providerAccountId])` maps to `auth callback idempotency`; domain error: `DuplicateAuthIdentityError`.
- `AuthSession @@unique([token])` maps to `findSessionByToken / RevokeSessionCommand`; domain error: `DuplicateSessionTokenError`.
- `AuthSession @@index([userId])` maps to `OnUserDeletedRevokeSessionsHandler`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


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

/**
 * Aggregate root for Auth invariants; persistence ignorant and reconstituted by repositories.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class AuthIdentity extends AggregateRoot<AuthIdentityId> {
  /**
   * Creates a new `AuthIdentity` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): AuthIdentity;

  /**
   * Rehydrates `AuthIdentity` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): AuthIdentity;

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
 * Strongly typed identifier for AuthIdentity; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class AuthIdentityId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): AuthIdentityId;
}

/**
 * Base domain error for violated Auth invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class AuthIdentityInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by AuthIdentity after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class UserRegisteredEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AuthIdentityId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by AuthIdentity after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class UserLoggedInEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AuthIdentityId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by AuthIdentity after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class SessionRevokedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AuthIdentityId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for AuthIdentity; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IAuthRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `AuthMapper.toDomain(row)` when present.
   */
  findById(id: AuthIdentityId): Promise<AuthIdentity | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `AuthMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `AuthIdentity`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: AuthIdentity): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the HandleSignUpComplete use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class HandleSignUpCompleteCommand extends Command<UserId> {
  /**
   * Captures all input required by HandleSignUpCompleteHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: HandleSignUpCompletePayload);
}

/**
 * Handles `HandleSignUpCompleteCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `authRepository: IAuthIdentityRepository` loads and saves `AuthIdentity` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `AuthIdentity` state through `authRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `AuthIdentity.handleSignUpComplete(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `authRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(HandleSignUpCompleteCommand)
class HandleSignUpCompleteHandler implements ICommandHandler<HandleSignUpCompleteCommand> {
  /**
   * Executes `HandleSignUpCompleteCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `AuthIdentity` state with `authRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `AuthIdentity` domain method for `HandleSignUpComplete` if not declared above.
   * 4. Persist with `authRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: HandleSignUpCompleteCommand): Promise<UserId>;
}

/**
 * Command input for the HandleLoginSucceeded use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class HandleLoginSucceededCommand extends Command<void> {
  /**
   * Captures all input required by HandleLoginSucceededHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: HandleLoginSucceededPayload);
}

/**
 * Handles `HandleLoginSucceededCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `authRepository: IAuthIdentityRepository` loads and saves `AuthIdentity` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `AuthIdentity` state through `authRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `AuthIdentity.handleLoginSucceeded(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `authRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(HandleLoginSucceededCommand)
class HandleLoginSucceededHandler implements ICommandHandler<HandleLoginSucceededCommand> {
  /**
   * Executes `HandleLoginSucceededCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `AuthIdentity` state with `authRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `AuthIdentity` domain method for `HandleLoginSucceeded` if not declared above.
   * 4. Persist with `authRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: HandleLoginSucceededCommand): Promise<void>;
}

/**
 * Command input for the RevokeSession use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RevokeSessionCommand extends Command<void> {
  /**
   * Captures all input required by RevokeSessionHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: RevokeSessionPayload);
}

/**
 * Handles `RevokeSessionCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `authRepository: IAuthIdentityRepository` loads and saves `AuthIdentity` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `AuthIdentity` state through `authRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `AuthIdentity.revokeSession(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `authRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(RevokeSessionCommand)
class RevokeSessionHandler implements ICommandHandler<RevokeSessionCommand> {
  /**
   * Executes `RevokeSessionCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `AuthIdentity` state with `authRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `AuthIdentity` domain method for `RevokeSession` if not declared above.
   * 4. Persist with `authRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: RevokeSessionCommand): Promise<void>;
}

/**
 * Query input for GetCurrentSession.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetCurrentSessionQuery extends Query<AuthSessionDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetCurrentSessionPayload);
}

/**
 * Handles `GetCurrentSessionQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `authRepository: IAuthIdentityRepository` reads `AuthIdentity` persistence state.
 * - `AuthMapper: AuthMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `authRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `AuthMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetCurrentSessionQuery)
class GetCurrentSessionHandler implements IQueryHandler<GetCurrentSessionQuery> {
  /**
   * Executes `GetCurrentSessionQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `authRepository` or the module read model.
   * 3. Map rows with `AuthMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetCurrentSessionQuery): Promise<AuthSessionDTO | null>;
}

/**
 * Event handler for `UserDeletedEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `UserDeletedEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(UserDeletedEvent)
class OnUserDeletedRevokeSessionsHandler implements IEventHandler<UserDeletedEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: UserDeletedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IAuthRepository; maps rows through AuthMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaAuthIdentityRepository implements IAuthRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: AuthIdentityId): Promise<AuthIdentity | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: AuthIdentity): Promise<void>;
}

/**
 * Injectable mapper for `AuthIdentity`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `AuthIdentity.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class AuthMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): AuthIdentity;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: AuthIdentity): unknown;
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
class AuthResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for AuthSessionGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type AuthSessionGraphQLTypeShape = Omit<AuthSessionDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class AuthSessionGraphQLType implements AuthSessionGraphQLTypeShape {
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
function toAuthSessionGraphQLType(dto: AuthSessionDTO): AuthSessionGraphQLType;

```

## EIP Patterns Applied

- **Idempotent Receiver**: Sign-up completion keys by provider identity/email so repeated auth callbacks resolve to one user identity. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: UserRegisteredEvent and UserLoggedInEvent capture auth milestones for audit and notifications. Status: fully specced with concrete signatures in the Implementation Spec.
