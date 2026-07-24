# Organization - DDD & EIP Analysis

## Current Responsibility

Organization owns team profiles and membership lifecycle for grouped clients or providers. Membership is part of the Organization aggregate and all member changes go through organization commands.

## Bounded Context Assessment

Organization is a distinct bounded context because it owns team profiles and membership lifecycle. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Organization` as the aggregate root and `OrganizationId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IOrganizationRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Organization` is the aggregate root and `OrganizationId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Organization {
  id String @id @map("_id")
  ownerId String
  name String
  createdAt DateTime
  updatedAt DateTime

  @@index([ownerId])
}

model OrgMember {
  id String @id @map("_id")
  orgId String
  userId String
  role String
  status String
  createdAt DateTime
  updatedAt DateTime

  @@unique([orgId, userId])
  @@index([userId])
}
```

Scalar-ID references and cleanup owners:
- `ownerId` references Users. Cleanup owner: UserDeletedPolicyHandler transfers ownership, deactivates memberships, or prevents deletion through Organization commands.
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler deactivates membership rows through Organization commands.

Indexes and constraints mapped to repository methods/domain errors:
- `@@index([ownerId])` maps to `GetMyOrganizationQuery`; domain error: `none`.
- `OrgMember @@unique([orgId, userId])` maps to `AddOrganizationMemberCommand`; domain error: `DuplicateOrganizationMemberError`.
- `OrgMember @@index([userId])` maps to `ListOrganizationMembersQuery / cleanup policies`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


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

/**
 * Aggregate root for `Organization` invariants; persistence ignorant and reconstituted by repositories.
 * Constructor fields:
 * - `id` is the strongly typed aggregate identifier.
 * - Other constructor fields are the scalar/value-object state listed in the Persistence Model.
 * - Timestamps preserve creation/update history from persistence.
 */
class Organization extends AggregateRoot<OrganizationId> {
  /**
   * Creates a new `Organization` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Organization;

  /**
   * Rehydrates `Organization` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Organization;

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
 * Strongly typed identifier for Organization; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class OrganizationId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): OrganizationId;
}

/**
 * Base domain error for violated Organization invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class OrganizationInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Organization after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class OrganizationCreatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: OrganizationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Organization after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class MemberAddedToOrganizationEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: OrganizationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Organization after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class MemberRemovedFromOrganizationEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: OrganizationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Organization; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IOrganizationRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `OrganizationMapper.toDomain(row)` when present.
   */
  findById(id: OrganizationId): Promise<Organization | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `OrganizationMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Organization`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Organization): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the CreateOrganization use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreateOrganizationCommand extends Command<OrganizationId> {
  /**
   * Captures all input required by CreateOrganizationHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CreateOrganizationPayload);
}

/**
 * Handles `CreateOrganizationCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `organizationRepository: IOrganizationRepository` loads and saves `Organization` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Organization` state through `organizationRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Organization.createOrganization(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `organizationRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CreateOrganizationCommand)
class CreateOrganizationHandler implements ICommandHandler<CreateOrganizationCommand> {
  /**
   * Executes `CreateOrganizationCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Organization` state with `organizationRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Organization` domain method for `CreateOrganization` if not declared above.
   * 4. Persist with `organizationRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CreateOrganizationCommand): Promise<OrganizationId>;
}

/**
 * Command input for the AddOrganizationMember use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class AddOrganizationMemberCommand extends Command<void> {
  /**
   * Captures all input required by AddOrganizationMemberHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: AddOrganizationMemberPayload);
}

/**
 * Handles `AddOrganizationMemberCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `organizationRepository: IOrganizationRepository` loads and saves `Organization` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Organization` state through `organizationRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Organization.addOrganizationMember(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `organizationRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(AddOrganizationMemberCommand)
class AddOrganizationMemberHandler implements ICommandHandler<AddOrganizationMemberCommand> {
  /**
   * Executes `AddOrganizationMemberCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Organization` state with `organizationRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Organization` domain method for `AddOrganizationMember` if not declared above.
   * 4. Persist with `organizationRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: AddOrganizationMemberCommand): Promise<void>;
}

/**
 * Command input for the RemoveOrganizationMember use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RemoveOrganizationMemberCommand extends Command<void> {
  /**
   * Captures all input required by RemoveOrganizationMemberHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: RemoveOrganizationMemberPayload);
}

/**
 * Handles `RemoveOrganizationMemberCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `organizationRepository: IOrganizationRepository` loads and saves `Organization` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Organization` state through `organizationRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Organization.removeOrganizationMember(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `organizationRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(RemoveOrganizationMemberCommand)
class RemoveOrganizationMemberHandler implements ICommandHandler<RemoveOrganizationMemberCommand> {
  /**
   * Executes `RemoveOrganizationMemberCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Organization` state with `organizationRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Organization` domain method for `RemoveOrganizationMember` if not declared above.
   * 4. Persist with `organizationRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: RemoveOrganizationMemberCommand): Promise<void>;
}

/**
 * Query input for GetMyOrganization.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetMyOrganizationQuery extends Query<OrganizationDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetMyOrganizationPayload);
}

/**
 * Handles `GetMyOrganizationQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `organizationRepository: IOrganizationRepository` reads `Organization` persistence state.
 * - `OrganizationMapper: OrganizationMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `organizationRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `OrganizationMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetMyOrganizationQuery)
class GetMyOrganizationHandler implements IQueryHandler<GetMyOrganizationQuery> {
  /**
   * Executes `GetMyOrganizationQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `organizationRepository` or the module read model.
   * 3. Map rows with `OrganizationMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetMyOrganizationQuery): Promise<OrganizationDTO | null>;
}

/**
 * Query input for ListOrganizationMembers.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class ListOrganizationMembersQuery extends Query<OrganizationMemberDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: ListOrganizationMembersPayload);
}

/**
 * Handles `ListOrganizationMembersQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `organizationRepository: IOrganizationRepository` reads `Organization` persistence state.
 * - `OrganizationMapper: OrganizationMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `organizationRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `OrganizationMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(ListOrganizationMembersQuery)
class ListOrganizationMembersHandler implements IQueryHandler<ListOrganizationMembersQuery> {
  /**
   * Executes `ListOrganizationMembersQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `organizationRepository` or the module read model.
   * 3. Map rows with `OrganizationMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: ListOrganizationMembersQuery): Promise<OrganizationMemberDTO[]>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IOrganizationRepository; maps rows through OrganizationMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaOrganizationRepository implements IOrganizationRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: OrganizationId): Promise<Organization | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Organization): Promise<void>;
}

/**
 * Injectable mapper for `Organization`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Organization.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class OrganizationMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Organization;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Organization): unknown;
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
class OrganizationResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for OrganizationGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type OrganizationGraphQLTypeShape = Omit<OrganizationDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class OrganizationGraphQLType implements OrganizationGraphQLTypeShape {
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
function toOrganizationGraphQLType(dto: OrganizationDTO): OrganizationGraphQLType;

/**
 * GraphQL shape for OrganizationMemberGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type OrganizationMemberGraphQLTypeShape = Omit<OrganizationMemberDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class OrganizationMemberGraphQLType implements OrganizationMemberGraphQLTypeShape {
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
function toOrganizationMemberGraphQLType(dto: OrganizationMemberDTO): OrganizationMemberGraphQLType;

```

## EIP Patterns Applied

- **Aggregate Boundary**: Organization controls membership consistency and prevents external modules from writing OrgMember rows directly. Status: fully specced with concrete signatures in the Implementation Spec.
- **Event Notification**: Membership changes emit events for audit and notification handlers. Status: fully specced with concrete signatures in the Implementation Spec.
