# Client - DDD & EIP Analysis

## Current Responsibility

Client owns requester profile state and dashboard read concerns. Errand, Wallet, and Rating remain independent; Client exposes a dashboard DTO assembled by query handlers without taking ownership of those aggregates.

## Bounded Context Assessment

Client is a distinct bounded context because it owns requester profile state and dashboard read concerns. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Client` as the aggregate root and `ClientId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IClientRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Client` is the aggregate root and `ClientId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Client {
  id String @id @map("_id")
  userId String
  verified Boolean
  ratingAverage Float
  ratingCount Int
  createdAt DateTime
  updatedAt DateTime

  @@unique([userId])
  @@index([verified])
}
```

Scalar-ID references and cleanup owners:
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler deactivates or soft-deletes client profiles through Client commands.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([userId])` maps to `findByUserId / CreateClientCommand`; domain error: `ClientAlreadyExistsError`.
- `@@index([verified])` maps to `client admin reads`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


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

/**
 * Aggregate root for `Client` invariants; persistence ignorant and reconstituted by repositories.
 * Constructor fields:
 * - `id` is the strongly typed aggregate identifier.
 * - Other constructor fields are the scalar/value-object state listed in the Persistence Model.
 * - Timestamps preserve creation/update history from persistence.
 */
class Client extends AggregateRoot<ClientId> {
  /**
   * Creates a new `Client` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Client;

  /**
   * Rehydrates `Client` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Client;

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
 * Strongly typed identifier for Client; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class ClientId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): ClientId;
}

/**
 * Base domain error for violated Client invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class ClientInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Client after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ClientCreatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ClientId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Client after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ClientVerifiedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ClientId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Client after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ClientRatingSnapshotUpdatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ClientId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Client; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IClientRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `ClientMapper.toDomain(row)` when present.
   */
  findById(id: ClientId): Promise<Client | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `ClientMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Client`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Client): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the CreateClient use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreateClientCommand extends Command<ClientId> {
  /**
   * Captures all input required by CreateClientHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CreateClientPayload);
}

/**
 * Handles `CreateClientCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `clientRepository: IClientRepository` loads and saves `Client` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Client` state through `clientRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Client.createClient(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `clientRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CreateClientCommand)
class CreateClientHandler implements ICommandHandler<CreateClientCommand> {
  /**
   * Executes `CreateClientCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Client` state with `clientRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Client` domain method for `CreateClient` if not declared above.
   * 4. Persist with `clientRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CreateClientCommand): Promise<ClientId>;
}

/**
 * Command input for the VerifyClient use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class VerifyClientCommand extends Command<void> {
  /**
   * Captures all input required by VerifyClientHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: VerifyClientPayload);
}

/**
 * Handles `VerifyClientCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `clientRepository: IClientRepository` loads and saves `Client` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Client` state through `clientRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Client.verifyClient(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `clientRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(VerifyClientCommand)
class VerifyClientHandler implements ICommandHandler<VerifyClientCommand> {
  /**
   * Executes `VerifyClientCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Client` state with `clientRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Client` domain method for `VerifyClient` if not declared above.
   * 4. Persist with `clientRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: VerifyClientCommand): Promise<void>;
}

/**
 * Command input for the UpdateClientRatingSnapshot use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class UpdateClientRatingSnapshotCommand extends Command<void> {
  /**
   * Captures all input required by UpdateClientRatingSnapshotHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: UpdateClientRatingSnapshotPayload);
}

/**
 * Handles `UpdateClientRatingSnapshotCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `clientRepository: IClientRepository` loads and saves `Client` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Client` state through `clientRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Client.updateClientRatingSnapshot(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `clientRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(UpdateClientRatingSnapshotCommand)
class UpdateClientRatingSnapshotHandler implements ICommandHandler<UpdateClientRatingSnapshotCommand> {
  /**
   * Executes `UpdateClientRatingSnapshotCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Client` state with `clientRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Client` domain method for `UpdateClientRatingSnapshot` if not declared above.
   * 4. Persist with `clientRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: UpdateClientRatingSnapshotCommand): Promise<void>;
}

/**
 * Query input for GetClient.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetClientQuery extends Query<ClientDTO> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetClientPayload);
}

/**
 * Handles `GetClientQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `clientRepository: IClientRepository` reads `Client` persistence state.
 * - `ClientMapper: ClientMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `clientRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ClientMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetClientQuery)
class GetClientHandler implements IQueryHandler<GetClientQuery> {
  /**
   * Executes `GetClientQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `clientRepository` or the module read model.
   * 3. Map rows with `ClientMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetClientQuery): Promise<ClientDTO>;
}

/**
 * Query input for GetClientDashboard.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetClientDashboardQuery extends Query<ClientDashboardDTO> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetClientDashboardPayload);
}

/**
 * Handles `GetClientDashboardQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `clientRepository: IClientRepository` reads `Client` persistence state.
 * - `ClientMapper: ClientMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `clientRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ClientMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetClientDashboardQuery)
class GetClientDashboardHandler implements IQueryHandler<GetClientDashboardQuery> {
  /**
   * Executes `GetClientDashboardQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `clientRepository` or the module read model.
   * 3. Map rows with `ClientMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetClientDashboardQuery): Promise<ClientDashboardDTO>;
}

/**
 * Event handler for `RatingCreatedEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `RatingCreatedEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(RatingCreatedEvent)
class OnRatingCreatedUpdateClientRatingHandler implements IEventHandler<RatingCreatedEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: RatingCreatedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IClientRepository; maps rows through ClientMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaClientRepository implements IClientRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: ClientId): Promise<Client | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Client): Promise<void>;
}

/**
 * Injectable mapper for `Client`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Client.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class ClientMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Client;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Client): unknown;
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
class ClientResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for ClientGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ClientGraphQLTypeShape = Omit<ClientDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ClientGraphQLType implements ClientGraphQLTypeShape {
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
function toClientGraphQLType(dto: ClientDTO): ClientGraphQLType;

/**
 * GraphQL shape for ClientDashboardGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ClientDashboardGraphQLTypeShape = Omit<ClientDashboardDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ClientDashboardGraphQLType implements ClientDashboardGraphQLTypeShape {
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
function toClientDashboardGraphQLType(dto: ClientDashboardDTO): ClientDashboardGraphQLType;

```

## EIP Patterns Applied

- **Materialized View**: ClientDashboardDTO composes client, errand, wallet, and rating read data without cross-aggregate writes. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event-Carried State Transfer**: RatingCreatedEvent carries enough rating data to update client rating snapshot without querying Rating synchronously. Status: fully specced with concrete signatures in the Implementation Spec.
