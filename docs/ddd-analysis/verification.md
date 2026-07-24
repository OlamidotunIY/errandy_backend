# Verification - DDD & EIP Analysis

## Current Responsibility

Verification owns provider verification attempts, OTP/code lifecycle, and approval events. Provider consumes the approval event to mark its profile verified; Verification keeps the audit record.

## Domain Model

`Verification` is the aggregate root and `VerificationId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

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

/** Aggregate root for Verification invariants; persistence ignorant and reconstituted by repositories. */
class Verification extends AggregateRoot<VerificationId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Verification;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Verification;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Verification; prevents cross-aggregate ID mix-ups. */
class VerificationId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): VerificationId;
}

/** Base domain error for violated Verification invariants. */
class VerificationInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Verification after its state transition is persisted. */
class VerificationCodeSentEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: VerificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Verification after its state transition is persisted. */
class ProviderVerificationApprovedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: VerificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Verification after its state transition is persisted. */
class VerificationExpiredEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: VerificationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Verification; domain/application depend on this contract, not Prisma. */
interface IVerificationRepository {
  /** Loads an aggregate by ID. */
  findById(id: VerificationId): Promise<Verification | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Verification): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the SendVerificationCode use case. */
class SendVerificationCodeCommand extends Command<VerificationId> {
  /** Captures all input required by SendVerificationCodeHandler. */
  constructor(public readonly payload: SendVerificationCodePayload);
}

/** Handles SendVerificationCodeCommand through the NestJS CommandBus. */
@CommandHandler(SendVerificationCodeCommand)
class SendVerificationCodeHandler implements ICommandHandler<SendVerificationCodeCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: SendVerificationCodeCommand): Promise<VerificationId>;
}

/** Command input for the VerifyCode use case. */
class VerifyCodeCommand extends Command<void> {
  /** Captures all input required by VerifyCodeHandler. */
  constructor(public readonly payload: VerifyCodePayload);
}

/** Handles VerifyCodeCommand through the NestJS CommandBus. */
@CommandHandler(VerifyCodeCommand)
class VerifyCodeHandler implements ICommandHandler<VerifyCodeCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: VerifyCodeCommand): Promise<void>;
}

/** Command input for the ExpireVerification use case. */
class ExpireVerificationCommand extends Command<void> {
  /** Captures all input required by ExpireVerificationHandler. */
  constructor(public readonly payload: ExpireVerificationPayload);
}

/** Handles ExpireVerificationCommand through the NestJS CommandBus. */
@CommandHandler(ExpireVerificationCommand)
class ExpireVerificationHandler implements ICommandHandler<ExpireVerificationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: ExpireVerificationCommand): Promise<void>;
}

/** Query input for GetVerification. */
class GetVerificationQuery extends Query<VerificationDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetVerificationPayload);
}

/** Handles GetVerificationQuery through the NestJS QueryBus. */
@QueryHandler(GetVerificationQuery)
class GetVerificationHandler implements IQueryHandler<GetVerificationQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetVerificationQuery): Promise<VerificationDTO | null>;
}

/** Scheduler/query side for ExpireStaleVerifications; finds eligible records and enqueues one BullMQ job per record/window. */
class ExpireStaleVerificationsJob {
  /** Enqueues work; it never processes records inline during the scheduler tick. */
  async enqueueDueJobs(): Promise<void>;
}

/** BullMQ processor for ExpireStaleVerifications; dispatches use cases through CommandBus and uses retry/backoff. */
@Processor('ExpireStaleVerifications')
class ExpireStaleVerificationsProcessor {
  /** Processes one queued payload with attempts=5 and exponential backoff; DLQ payload includes original payload, correlationId, failure reason, attempt count, and every idempotency key or gatewayReference needed for safe replay. */
  async process(job: Job<ExpireStaleVerificationsPayload>): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IVerificationRepository; maps rows through VerificationMapper. */
@Injectable()
class PrismaVerificationRepository implements IVerificationRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: VerificationId): Promise<Verification | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Verification): Promise<void>;
}

/** Injectable mapper for Verification; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class VerificationMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Verification;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Verification): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class VerificationResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for VerificationGraphQLType; separate from application DTOs. */
type VerificationGraphQLTypeShape = Omit<VerificationDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class VerificationGraphQLType implements VerificationGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toVerificationGraphQLType(dto: VerificationDTO): VerificationGraphQLType;

```

## EIP Patterns Applied

- **Idempotent Receiver**: providerId/type uniqueness keeps one current verification record per verification type. Status: fully specced with concrete signatures in the Implementation Spec.
- **Message Expiration**: ExpireStaleVerificationsJob expires verification records beyond their validity window. Status: fully specced with concrete signatures in the Implementation Spec.
