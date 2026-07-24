# Escrow - DDD & EIP Analysis

## Current Responsibility

Escrow owns payment holds around accepted errands. It models a two-phase hold: funds are first secured for active work, then after completion the worker payout enters a clearance window before release to available wallet balance.

## Bounded Context Assessment

Escrow is a distinct bounded context because it owns two-phase funded, completed-pending-payout, released/refunded escrow lifecycle. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Escrow` as the aggregate root and `EscrowId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IEscrowRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Escrow` is the aggregate root and `EscrowId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Escrow {
  id String @id @map("_id")
  errandId String
  clientId String
  workerId String
  amountGrossKobo Int
  platformFeeKobo Int
  amountNetWorkerKobo Int
  currency String
  status EscrowStatus
  holdUntil DateTime?
  releaseEligibleAt DateTime?
  releasedAt DateTime?
  refundedAt DateTime?
  gatewayReference String?
  createdAt DateTime
  updatedAt DateTime

  @@unique([errandId])
  @@index([status, releaseEligibleAt])
  @@index([clientId, status])
  @@index([workerId, status])
}
```

Scalar-ID references and cleanup owners:
- `errandId` references Errands. Cleanup owner: ErrandDeletedPolicyHandler prevents hard deletion while escrow records exist.
- `clientId` references Client. Cleanup owner: ClientDeletedPolicyHandler preserves scalar audit history and anonymizes profile display elsewhere.
- `workerId` references Provider. Cleanup owner: ProviderDeletedPolicyHandler preserves payout audit history and prevents destructive deletion for active escrows.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([errandId])` maps to `save / findByErrandId`; domain error: `EscrowAlreadyExistsError`.
- `@@index([status, releaseEligibleAt])` maps to `findMaturedForRelease for ReleaseMaturedEscrowsJob`; domain error: `none`.
- `@@index([clientId, status])` maps to `client escrow queries and cleanup policies`; domain error: `none`.
- `@@index([workerId, status])` maps to `worker escrow queries and cleanup policies`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


## Target Structure

```text
src/escrow/
  domain/
    entities/
      Escrow.ts
    value-objects/
      EscrowId.ts
    errors/
      EscrowInvariantError.ts
    events/
      EscrowFundedEvent.ts
      EscrowReleasingEvent.ts
      EscrowReleasedEvent.ts
      EscrowRefundingEvent.ts
      EscrowRefundedEvent.ts
      EscrowDisputedEvent.ts
    repositories/
      IEscrowRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      FundEscrow/
        FundEscrowCommand.ts
        FundEscrowHandler.ts
      MarkEscrowCompleted/
        MarkEscrowCompletedCommand.ts
        MarkEscrowCompletedHandler.ts
      ReleaseEscrow/
        ReleaseEscrowCommand.ts
        ReleaseEscrowHandler.ts
      RefundEscrow/
        RefundEscrowCommand.ts
        RefundEscrowHandler.ts
    queries/
      GetEscrowByErrand/
        GetEscrowByErrandQuery.ts
        GetEscrowByErrandHandler.ts
    sagas/
      (none)
    event-handlers/
      OnErrandCompletedMarkEscrowHandler.ts
    jobs/
      ReleaseMaturedEscrowsJob.ts
      ReleaseMaturedEscrowsProcessor.ts
  infrastructure/
    repositories/
      PrismaEscrowRepository.ts
    mappers/
      EscrowMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      EscrowResolver.ts
    graphql/
      EscrowGraphQLType.type.ts
      mappers/
        toEscrowGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/**
 * Aggregate root for `Escrow` invariants; persistence ignorant and reconstituted by repositories.
 * Constructor fields:
 * - `id` is the strongly typed aggregate identifier.
 * - Other constructor fields are the scalar/value-object state listed in the Persistence Model.
 * - Timestamps preserve creation/update history from persistence.
 */
class Escrow extends AggregateRoot<EscrowId> {
  /**
   * Creates a new `Escrow` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Escrow;

  /**
   * Rehydrates `Escrow` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Escrow;

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
 * Strongly typed identifier for Escrow; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class EscrowId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): EscrowId;
}

/**
 * Base domain error for violated Escrow invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class EscrowInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Escrow after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class EscrowFundedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Escrow after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class EscrowReleasingEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Escrow after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class EscrowReleasedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Escrow after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class EscrowRefundingEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Escrow after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class EscrowRefundedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Escrow after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class EscrowDisputedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: EscrowId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Escrow; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IEscrowRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `EscrowMapper.toDomain(row)` when present.
   */
  findById(id: EscrowId): Promise<Escrow | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `EscrowMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Escrow`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Escrow): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the FundEscrow use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class FundEscrowCommand extends Command<FundEscrowResult> {
  /**
   * Captures all input required by FundEscrowHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: FundEscrowPayload);
}

/**
 * Handles `FundEscrowCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `escrowRepository: IEscrowRepository` loads and saves `Escrow` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Escrow` state through `escrowRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Escrow.fundEscrow(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `escrowRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(FundEscrowCommand)
class FundEscrowHandler implements ICommandHandler<FundEscrowCommand> {
  /**
   * Executes `FundEscrowCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Escrow` state with `escrowRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Escrow` domain method for `FundEscrow` if not declared above.
   * 4. Persist with `escrowRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: FundEscrowCommand): Promise<FundEscrowResult>;
}

/**
 * Command input for the MarkEscrowCompleted use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class MarkEscrowCompletedCommand extends Command<void> {
  /**
   * Captures all input required by MarkEscrowCompletedHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: MarkEscrowCompletedPayload);
}

/**
 * Handles `MarkEscrowCompletedCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `escrowRepository: IEscrowRepository` loads and saves `Escrow` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Escrow` state through `escrowRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Escrow.markEscrowCompleted(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `escrowRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(MarkEscrowCompletedCommand)
class MarkEscrowCompletedHandler implements ICommandHandler<MarkEscrowCompletedCommand> {
  /**
   * Executes `MarkEscrowCompletedCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Escrow` state with `escrowRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Escrow` domain method for `MarkEscrowCompleted` if not declared above.
   * 4. Persist with `escrowRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: MarkEscrowCompletedCommand): Promise<void>;
}

/**
 * Command input for the ReleaseEscrow use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class ReleaseEscrowCommand extends Command<void> {
  /**
   * Captures all input required by ReleaseEscrowHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: ReleaseEscrowPayload);
}

/**
 * Handles `ReleaseEscrowCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `escrowRepository: IEscrowRepository` loads and saves `Escrow` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Escrow` state through `escrowRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Escrow.releaseEscrow(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `escrowRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(ReleaseEscrowCommand)
class ReleaseEscrowHandler implements ICommandHandler<ReleaseEscrowCommand> {
  /**
   * Executes `ReleaseEscrowCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Escrow` state with `escrowRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Escrow` domain method for `ReleaseEscrow` if not declared above.
   * 4. Persist with `escrowRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: ReleaseEscrowCommand): Promise<void>;
}

/**
 * Command input for the RefundEscrow use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RefundEscrowCommand extends Command<void> {
  /**
   * Captures all input required by RefundEscrowHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: RefundEscrowPayload);
}

/**
 * Handles `RefundEscrowCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `escrowRepository: IEscrowRepository` loads and saves `Escrow` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Escrow` state through `escrowRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Escrow.refundEscrow(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `escrowRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(RefundEscrowCommand)
class RefundEscrowHandler implements ICommandHandler<RefundEscrowCommand> {
  /**
   * Executes `RefundEscrowCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Escrow` state with `escrowRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Escrow` domain method for `RefundEscrow` if not declared above.
   * 4. Persist with `escrowRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: RefundEscrowCommand): Promise<void>;
}

/**
 * Query input for GetEscrowByErrand.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetEscrowByErrandQuery extends Query<EscrowDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetEscrowByErrandPayload);
}

/**
 * Handles `GetEscrowByErrandQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `escrowRepository: IEscrowRepository` reads `Escrow` persistence state.
 * - `EscrowMapper: EscrowMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `escrowRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `EscrowMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetEscrowByErrandQuery)
class GetEscrowByErrandHandler implements IQueryHandler<GetEscrowByErrandQuery> {
  /**
   * Executes `GetEscrowByErrandQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `escrowRepository` or the module read model.
   * 3. Map rows with `EscrowMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetEscrowByErrandQuery): Promise<EscrowDTO | null>;
}

/**
 * Event handler for `ErrandCompletedEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `ErrandCompletedEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(ErrandCompletedEvent)
class OnErrandCompletedMarkEscrowHandler implements IEventHandler<ErrandCompletedEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: ErrandCompletedEvent): Promise<void>;
}

/**
 * Scheduler/query side for ReleaseMaturedEscrows; finds eligible records and enqueues one BullMQ job per record/window.
 * Constructor dependencies:
 * - repository/query service dependency finds eligible records or windows.
 * - `queue: Queue` enqueues BullMQ payloads.
 * - `logger: ILogger` records enqueue failures and cursors.
 */
class ReleaseMaturedEscrowsJob {
  /**
   * Runs the `ReleaseMaturedEscrows` scheduler method.
   * 1. Query eligible records/windows through the module repository.
   * 2. Build one BullMQ payload per record/window.
   * 3. Enqueue with `queue.add('ReleaseMaturedEscrows', payload, retryOptions)`.
   * 4. Persist scheduler cursor/state only after enqueue succeeds.
   * 5. Do not perform business processing inline in the scheduler tick.
   */
  async enqueueDueJobs(): Promise<void>;
}

/**
 * BullMQ processor for ReleaseMaturedEscrows; dispatches use cases through CommandBus and uses retry/backoff.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches the use case for one job payload.
 * - repository/adapter dependencies load job-specific context when needed.
 * - `logger: ILogger` records retry and DLQ failures.
 */
@Processor('ReleaseMaturedEscrows')
class ReleaseMaturedEscrowsProcessor {
  /**
   * Processes one `ReleaseMaturedEscrows` BullMQ payload.
   * 1. Validate `job.data` contains every replay ID and correlation field documented in the payload interface.
   * 2. Build the relevant command from `job.data`.
   * 3. Dispatch with `commandBus.execute(new XCommand(job.data))`.
   * 4. Retry only transient infrastructure failures according to BullMQ attempts/backoff.
   * 5. After retries exhaust, write a DLQ entry with original payload, failure reason, and attempt count.
   */
  async process(job: Job<ReleaseMaturedEscrowsPayload>): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IEscrowRepository; maps rows through EscrowMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaEscrowRepository implements IEscrowRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: EscrowId): Promise<Escrow | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Escrow): Promise<void>;
}

/**
 * Injectable mapper for `Escrow`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Escrow.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class EscrowMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Escrow;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Escrow): unknown;
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
class EscrowResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for EscrowGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type EscrowGraphQLTypeShape = Omit<EscrowDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class EscrowGraphQLType implements EscrowGraphQLTypeShape {
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
function toEscrowGraphQLType(dto: EscrowDTO): EscrowGraphQLType;

```

## EIP Patterns Applied

- **Saga / Process Manager**: Escrow participates in application acceptance and completion workflows through commands and events. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: errandId uniqueness and gateway idempotency keys prevent duplicate escrow funding. Status: fully specced with concrete signatures in the Implementation Spec.
- **Dead Letter Channel**: ReleaseMaturedEscrowsProcessor retries matured releases and stores failed payloads with escrowId for replay. Status: fully specced with concrete signatures in the Implementation Spec.
