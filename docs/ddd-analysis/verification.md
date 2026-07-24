# Verification - DDD & EIP Analysis

## Current Responsibility

Verification owns provider verification attempts, OTP/code lifecycle, and approval events. Provider consumes the approval event to mark its profile verified; Verification keeps the audit record.

## Bounded Context Assessment

Verification is a distinct bounded context because it owns provider verification attempts, OTP/code lifecycle, expiration, and approval events. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `Verification` as the aggregate root and `VerificationId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IVerificationRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`Verification` is the aggregate root and `VerificationId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model Verification {
  id String @id @map("_id")
  providerId String
  type VerificationType
  status VerificationStatus
  codeHash String?
  expiresAt DateTime
  verifiedAt DateTime?
  metadata Json?
  createdAt DateTime
  updatedAt DateTime

  @@unique([providerId, type])
  @@index([status, expiresAt])
  @@index([providerId, status])
}
```

Scalar-ID references and cleanup owners:
- `providerId` references Provider. Cleanup owner: ProviderDeletedPolicyHandler archives verification records or deletes pending records through Verification commands.

Indexes and constraints mapped to repository methods/domain errors:
- `@@unique([providerId, type])` maps to `findByProviderAndType / SendVerificationCodeCommand`; domain error: `VerificationAlreadyExistsError`.
- `@@index([status, expiresAt])` maps to `ExpireStaleVerificationsJob`; domain error: `none`.
- `@@index([providerId, status])` maps to `GetVerificationQuery`; domain error: `none`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


## Target Structure

```text
src/verification/
  domain/
    entities/
      Verification.ts
    value-objects/
      VerificationId.ts
    errors/
      VerificationInvariantError.ts
    events/
      VerificationCodeSentEvent.ts
      ProviderVerificationApprovedEvent.ts
      VerificationExpiredEvent.ts
    repositories/
      IVerificationRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      SendVerificationCode/
        SendVerificationCodeCommand.ts
        SendVerificationCodeHandler.ts
      VerifyCode/
        VerifyCodeCommand.ts
        VerifyCodeHandler.ts
      ExpireVerification/
        ExpireVerificationCommand.ts
        ExpireVerificationHandler.ts
    queries/
      GetVerification/
        GetVerificationQuery.ts
        GetVerificationHandler.ts
    sagas/
      (none)
    event-handlers/
      (none)
    jobs/
      ExpireStaleVerificationsJob.ts
      ExpireStaleVerificationsProcessor.ts
  infrastructure/
    repositories/
      PrismaVerificationRepository.ts
    mappers/
      VerificationMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      VerificationResolver.ts
    graphql/
      VerificationGraphQLType.type.ts
      mappers/
        toVerificationGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/**
 * Aggregate root for `Verification` invariants; persistence ignorant and reconstituted by repositories.
 * Constructor fields:
 * - `id` is the strongly typed aggregate identifier.
 * - Other constructor fields are the scalar/value-object state listed in the Persistence Model.
 * - Timestamps preserve creation/update history from persistence.
 */
class Verification extends AggregateRoot<VerificationId> {
  /**
   * Creates a new `Verification` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): Verification;

  /**
   * Rehydrates `Verification` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): Verification;

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
 * Strongly typed identifier for Verification; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class VerificationId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): VerificationId;
}

/**
 * Base domain error for violated Verification invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class VerificationInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by Verification after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class VerificationCodeSentEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: VerificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Verification after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ProviderVerificationApprovedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: VerificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by Verification after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class VerificationExpiredEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: VerificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for Verification; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IVerificationRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `VerificationMapper.toDomain(row)` when present.
   */
  findById(id: VerificationId): Promise<Verification | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `VerificationMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `Verification`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: Verification): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the SendVerificationCode use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class SendVerificationCodeCommand extends Command<VerificationId> {
  /**
   * Captures all input required by SendVerificationCodeHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: SendVerificationCodePayload);
}

/**
 * Handles `SendVerificationCodeCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `verificationRepository: IVerificationRepository` loads and saves `Verification` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Verification` state through `verificationRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Verification.sendVerificationCode(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `verificationRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(SendVerificationCodeCommand)
class SendVerificationCodeHandler implements ICommandHandler<SendVerificationCodeCommand> {
  /**
   * Executes `SendVerificationCodeCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Verification` state with `verificationRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Verification` domain method for `SendVerificationCode` if not declared above.
   * 4. Persist with `verificationRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: SendVerificationCodeCommand): Promise<VerificationId>;
}

/**
 * Command input for the VerifyCode use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class VerifyCodeCommand extends Command<void> {
  /**
   * Captures all input required by VerifyCodeHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: VerifyCodePayload);
}

/**
 * Handles `VerifyCodeCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `verificationRepository: IVerificationRepository` loads and saves `Verification` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Verification` state through `verificationRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Verification.verifyCode(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `verificationRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(VerifyCodeCommand)
class VerifyCodeHandler implements ICommandHandler<VerifyCodeCommand> {
  /**
   * Executes `VerifyCodeCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Verification` state with `verificationRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Verification` domain method for `VerifyCode` if not declared above.
   * 4. Persist with `verificationRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: VerifyCodeCommand): Promise<void>;
}

/**
 * Command input for the ExpireVerification use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class ExpireVerificationCommand extends Command<void> {
  /**
   * Captures all input required by ExpireVerificationHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: ExpireVerificationPayload);
}

/**
 * Handles `ExpireVerificationCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `verificationRepository: IVerificationRepository` loads and saves `Verification` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `Verification` state through `verificationRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `Verification.expireVerification(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `verificationRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(ExpireVerificationCommand)
class ExpireVerificationHandler implements ICommandHandler<ExpireVerificationCommand> {
  /**
   * Executes `ExpireVerificationCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `Verification` state with `verificationRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `Verification` domain method for `ExpireVerification` if not declared above.
   * 4. Persist with `verificationRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: ExpireVerificationCommand): Promise<void>;
}

/**
 * Query input for GetVerification.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetVerificationQuery extends Query<VerificationDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetVerificationPayload);
}

/**
 * Handles `GetVerificationQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `verificationRepository: IVerificationRepository` reads `Verification` persistence state.
 * - `VerificationMapper: VerificationMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `verificationRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `VerificationMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetVerificationQuery)
class GetVerificationHandler implements IQueryHandler<GetVerificationQuery> {
  /**
   * Executes `GetVerificationQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `verificationRepository` or the module read model.
   * 3. Map rows with `VerificationMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetVerificationQuery): Promise<VerificationDTO | null>;
}

/**
 * Scheduler/query side for ExpireStaleVerifications; finds eligible records and enqueues one BullMQ job per record/window.
 * Constructor dependencies:
 * - repository/query service dependency finds eligible records or windows.
 * - `queue: Queue` enqueues BullMQ payloads.
 * - `logger: ILogger` records enqueue failures and cursors.
 */
class ExpireStaleVerificationsJob {
  /**
   * Runs the `ExpireStaleVerifications` scheduler method.
   * 1. Query eligible records/windows through the module repository.
   * 2. Build one BullMQ payload per record/window.
   * 3. Enqueue with `queue.add('ExpireStaleVerifications', payload, retryOptions)`.
   * 4. Persist scheduler cursor/state only after enqueue succeeds.
   * 5. Do not perform business processing inline in the scheduler tick.
   */
  async enqueueDueJobs(): Promise<void>;
}

/**
 * BullMQ processor for ExpireStaleVerifications; dispatches use cases through CommandBus and uses retry/backoff.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches the use case for one job payload.
 * - repository/adapter dependencies load job-specific context when needed.
 * - `logger: ILogger` records retry and DLQ failures.
 */
@Processor('ExpireStaleVerifications')
class ExpireStaleVerificationsProcessor {
  /**
   * Processes one `ExpireStaleVerifications` BullMQ payload.
   * 1. Validate `job.data` contains every replay ID and correlation field documented in the payload interface.
   * 2. Build the relevant command from `job.data`.
   * 3. Dispatch with `commandBus.execute(new XCommand(job.data))`.
   * 4. Retry only transient infrastructure failures according to BullMQ attempts/backoff.
   * 5. After retries exhaust, write a DLQ entry with original payload, failure reason, and attempt count.
   */
  async process(job: Job<ExpireStaleVerificationsPayload>): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IVerificationRepository; maps rows through VerificationMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaVerificationRepository implements IVerificationRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: VerificationId): Promise<Verification | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: Verification): Promise<void>;
}

/**
 * Injectable mapper for `Verification`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `Verification.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class VerificationMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): Verification;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: Verification): unknown;
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
class VerificationResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for VerificationGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type VerificationGraphQLTypeShape = Omit<VerificationDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class VerificationGraphQLType implements VerificationGraphQLTypeShape {
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
function toVerificationGraphQLType(dto: VerificationDTO): VerificationGraphQLType;

```

## EIP Patterns Applied

- **Idempotent Receiver**: providerId/type uniqueness keeps one current verification record per verification type. Status: fully specced with concrete signatures in the Implementation Spec.
- **Message Expiration**: ExpireStaleVerificationsJob expires verification records beyond their validity window. Status: fully specced with concrete signatures in the Implementation Spec.
