# Address - DDD & EIP Analysis

## Current Responsibility

Address owns saved user addresses, address suggestions, reverse geocoding, and coordinate normalization. Users may reference an active AddressId but cannot mutate address records directly.

## Bounded Context Assessment

Address is a distinct bounded context because it owns saved addresses, suggestions, reverse geocoding, and coordinate normalization. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `UserAddress` as the aggregate root and `AddressId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IUserAddressRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`UserAddress` is the aggregate root and `AddressId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model UserAddress {
  id String @id @map("_id")
  userId String
  label String?
  formattedAddress String
  latitude Float
  longitude Float
  placeId String?
  createdAt DateTime
  updatedAt DateTime

  @@index([id])
  @@index([userId, createdAt])
  @@index([placeId])
}
```

Scalar-ID references and cleanup owners:
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler deletes or archives saved addresses through Address commands.

Indexes and constraints mapped to repository methods/domain errors:
- `@@index([id])` maps to `findById`; domain error: `none`.
- `@@index([userId, createdAt])` maps to `GetUserAddressesQuery`; domain error: `none`.
- `@@index([placeId])` maps to `SaveUserAddressCommand duplicate-hint lookups`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


## Target Structure

```text
src/address/
  domain/
    entities/
      UserAddress.ts
    value-objects/
      AddressId.ts
    errors/
      UserAddressInvariantError.ts
    events/
      AddressSavedEvent.ts
      AddressDeletedEvent.ts
      AddressSuggestionsResolvedEvent.ts
      ReverseGeocodeResolvedEvent.ts
    repositories/
      IUserAddressRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      SaveUserAddress/
        SaveUserAddressCommand.ts
        SaveUserAddressHandler.ts
      DeleteUserAddress/
        DeleteUserAddressCommand.ts
        DeleteUserAddressHandler.ts
    queries/
      SuggestAddresses/
        SuggestAddressesQuery.ts
        SuggestAddressesHandler.ts
      ReverseGeocode/
        ReverseGeocodeQuery.ts
        ReverseGeocodeHandler.ts
      GetUserAddresses/
        GetUserAddressesQuery.ts
        GetUserAddressesHandler.ts
    sagas/
      (none)
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaUserAddressRepository.ts
    mappers/
      AddressMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      AddressResolver.ts
    graphql/
      UserAddressGraphQLType.type.ts
      AddressSuggestionGraphQLType.type.ts
      mappers/
        toUserAddressGraphQLType.ts
        toAddressSuggestionGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/**
 * Aggregate root for Address invariants; persistence ignorant and reconstituted by repositories.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class UserAddress extends AggregateRoot<AddressId> {
  /**
   * Creates a new `UserAddress` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): UserAddress;

  /**
   * Rehydrates `UserAddress` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): UserAddress;

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
 * Strongly typed identifier for UserAddress; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class AddressId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): AddressId;
}

/**
 * Base domain error for violated Address invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class UserAddressInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by UserAddress after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class AddressSavedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by UserAddress after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class AddressDeletedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by UserAddress after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class AddressSuggestionsResolvedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by UserAddress after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ReverseGeocodeResolvedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for UserAddress; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IUserAddressRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `AddressMapper.toDomain(row)` when present.
   */
  findById(id: AddressId): Promise<UserAddress | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `AddressMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `UserAddress`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: UserAddress): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the SaveUserAddress use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class SaveUserAddressCommand extends Command<AddressId> {
  /**
   * Captures all input required by SaveUserAddressHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: SaveUserAddressPayload);
}

/**
 * Handles `SaveUserAddressCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `userAddressRepository: IUserAddressRepository` loads and saves `UserAddress` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `UserAddress` state through `userAddressRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `UserAddress.saveUserAddress(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `userAddressRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(SaveUserAddressCommand)
class SaveUserAddressHandler implements ICommandHandler<SaveUserAddressCommand> {
  /**
   * Executes `SaveUserAddressCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `UserAddress` state with `userAddressRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `UserAddress` domain method for `SaveUserAddress` if not declared above.
   * 4. Persist with `userAddressRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: SaveUserAddressCommand): Promise<AddressId>;
}

/**
 * Command input for the DeleteUserAddress use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class DeleteUserAddressCommand extends Command<void> {
  /**
   * Captures all input required by DeleteUserAddressHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: DeleteUserAddressPayload);
}

/**
 * Handles `DeleteUserAddressCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `userAddressRepository: IUserAddressRepository` loads and saves `UserAddress` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `UserAddress` state through `userAddressRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `UserAddress.deleteUserAddress(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `userAddressRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(DeleteUserAddressCommand)
class DeleteUserAddressHandler implements ICommandHandler<DeleteUserAddressCommand> {
  /**
   * Executes `DeleteUserAddressCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `UserAddress` state with `userAddressRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `UserAddress` domain method for `DeleteUserAddress` if not declared above.
   * 4. Persist with `userAddressRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: DeleteUserAddressCommand): Promise<void>;
}

/**
 * Query input for SuggestAddresses.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class SuggestAddressesQuery extends Query<AddressSuggestionDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: SuggestAddressesPayload);
}

/**
 * Handles `SuggestAddressesQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `userAddressRepository: IUserAddressRepository` reads `UserAddress` persistence state.
 * - `AddressMapper: AddressMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `userAddressRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `AddressMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(SuggestAddressesQuery)
class SuggestAddressesHandler implements IQueryHandler<SuggestAddressesQuery> {
  /**
   * Executes `SuggestAddressesQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `userAddressRepository` or the module read model.
   * 3. Map rows with `AddressMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: SuggestAddressesQuery): Promise<AddressSuggestionDTO[]>;
}

/**
 * Query input for ReverseGeocode.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class ReverseGeocodeQuery extends Query<AddressSuggestionDTO> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: ReverseGeocodePayload);
}

/**
 * Handles `ReverseGeocodeQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `userAddressRepository: IUserAddressRepository` reads `UserAddress` persistence state.
 * - `AddressMapper: AddressMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `userAddressRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `AddressMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(ReverseGeocodeQuery)
class ReverseGeocodeHandler implements IQueryHandler<ReverseGeocodeQuery> {
  /**
   * Executes `ReverseGeocodeQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `userAddressRepository` or the module read model.
   * 3. Map rows with `AddressMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: ReverseGeocodeQuery): Promise<AddressSuggestionDTO>;
}

/**
 * Query input for GetUserAddresses.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetUserAddressesQuery extends Query<UserAddressDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetUserAddressesPayload);
}

/**
 * Handles `GetUserAddressesQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `userAddressRepository: IUserAddressRepository` reads `UserAddress` persistence state.
 * - `AddressMapper: AddressMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `userAddressRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `AddressMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetUserAddressesQuery)
class GetUserAddressesHandler implements IQueryHandler<GetUserAddressesQuery> {
  /**
   * Executes `GetUserAddressesQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `userAddressRepository` or the module read model.
   * 3. Map rows with `AddressMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetUserAddressesQuery): Promise<UserAddressDTO[]>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IUserAddressRepository; maps rows through AddressMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaUserAddressRepository implements IUserAddressRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: AddressId): Promise<UserAddress | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: UserAddress): Promise<void>;
}

/**
 * Injectable mapper for `UserAddress`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `UserAddress.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class AddressMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): UserAddress;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: UserAddress): unknown;
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
class AddressResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for UserAddressGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type UserAddressGraphQLTypeShape = Omit<UserAddressDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class UserAddressGraphQLType implements UserAddressGraphQLTypeShape {
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
function toUserAddressGraphQLType(dto: UserAddressDTO): UserAddressGraphQLType;

/**
 * GraphQL shape for AddressSuggestionGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type AddressSuggestionGraphQLTypeShape = Omit<AddressSuggestionDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class AddressSuggestionGraphQLType implements AddressSuggestionGraphQLTypeShape {
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
function toAddressSuggestionGraphQLType(dto: AddressSuggestionDTO): AddressSuggestionGraphQLType;

```

## EIP Patterns Applied

- **Request-Reply**: Suggestion and reverse-geocode queries wrap external geocoder calls behind QueryBus request/response. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: AddressDeletedEvent lets Users clear activeAddressId after the address deletion write succeeds. Status: fully specced with concrete signatures in the Implementation Spec.
