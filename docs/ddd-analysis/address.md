# Address - DDD & EIP Analysis

## Current Responsibility

Address owns saved user addresses, address suggestions, reverse geocoding, and coordinate normalization. Users may reference an active AddressId but cannot mutate address records directly.

## Domain Model

`UserAddress` is the aggregate root and `AddressId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

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

/** Aggregate root for Address invariants; persistence ignorant and reconstituted by repositories. */
class UserAddress extends AggregateRoot<AddressId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): UserAddress;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): UserAddress;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for UserAddress; prevents cross-aggregate ID mix-ups. */
class AddressId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): AddressId;
}

/** Base domain error for violated Address invariants. */
class UserAddressInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by UserAddress after its state transition is persisted. */
class AddressSavedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by UserAddress after its state transition is persisted. */
class AddressDeletedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by UserAddress after its state transition is persisted. */
class AddressSuggestionsResolvedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by UserAddress after its state transition is persisted. */
class ReverseGeocodeResolvedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: AddressId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for UserAddress; domain/application depend on this contract, not Prisma. */
interface IUserAddressRepository {
  /** Loads an aggregate by ID. */
  findById(id: AddressId): Promise<UserAddress | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: UserAddress): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the SaveUserAddress use case. */
class SaveUserAddressCommand extends Command<AddressId> {
  /** Captures all input required by SaveUserAddressHandler. */
  constructor(public readonly payload: SaveUserAddressPayload);
}

/** Handles SaveUserAddressCommand through the NestJS CommandBus. */
@CommandHandler(SaveUserAddressCommand)
class SaveUserAddressHandler implements ICommandHandler<SaveUserAddressCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: SaveUserAddressCommand): Promise<AddressId>;
}

/** Command input for the DeleteUserAddress use case. */
class DeleteUserAddressCommand extends Command<void> {
  /** Captures all input required by DeleteUserAddressHandler. */
  constructor(public readonly payload: DeleteUserAddressPayload);
}

/** Handles DeleteUserAddressCommand through the NestJS CommandBus. */
@CommandHandler(DeleteUserAddressCommand)
class DeleteUserAddressHandler implements ICommandHandler<DeleteUserAddressCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: DeleteUserAddressCommand): Promise<void>;
}

/** Query input for SuggestAddresses. */
class SuggestAddressesQuery extends Query<AddressSuggestionDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: SuggestAddressesPayload);
}

/** Handles SuggestAddressesQuery through the NestJS QueryBus. */
@QueryHandler(SuggestAddressesQuery)
class SuggestAddressesHandler implements IQueryHandler<SuggestAddressesQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: SuggestAddressesQuery): Promise<AddressSuggestionDTO[]>;
}

/** Query input for ReverseGeocode. */
class ReverseGeocodeQuery extends Query<AddressSuggestionDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: ReverseGeocodePayload);
}

/** Handles ReverseGeocodeQuery through the NestJS QueryBus. */
@QueryHandler(ReverseGeocodeQuery)
class ReverseGeocodeHandler implements IQueryHandler<ReverseGeocodeQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: ReverseGeocodeQuery): Promise<AddressSuggestionDTO>;
}

/** Query input for GetUserAddresses. */
class GetUserAddressesQuery extends Query<UserAddressDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetUserAddressesPayload);
}

/** Handles GetUserAddressesQuery through the NestJS QueryBus. */
@QueryHandler(GetUserAddressesQuery)
class GetUserAddressesHandler implements IQueryHandler<GetUserAddressesQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetUserAddressesQuery): Promise<UserAddressDTO[]>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IUserAddressRepository; maps rows through AddressMapper. */
@Injectable()
class PrismaUserAddressRepository implements IUserAddressRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: AddressId): Promise<UserAddress | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: UserAddress): Promise<void>;
}

/** Injectable mapper for UserAddress; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class AddressMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): UserAddress;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: UserAddress): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class AddressResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for UserAddressGraphQLType; separate from application DTOs. */
type UserAddressGraphQLTypeShape = Omit<UserAddressDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class UserAddressGraphQLType implements UserAddressGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toUserAddressGraphQLType(dto: UserAddressDTO): UserAddressGraphQLType;

/** GraphQL shape for AddressSuggestionGraphQLType; separate from application DTOs. */
type AddressSuggestionGraphQLTypeShape = Omit<AddressSuggestionDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class AddressSuggestionGraphQLType implements AddressSuggestionGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toAddressSuggestionGraphQLType(dto: AddressSuggestionDTO): AddressSuggestionGraphQLType;

```

## EIP Patterns Applied

- **Request-Reply**: Suggestion and reverse-geocode queries wrap external geocoder calls behind QueryBus request/response. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: AddressDeletedEvent lets Users clear activeAddressId after the address deletion write succeeds. Status: fully specced with concrete signatures in the Implementation Spec.
