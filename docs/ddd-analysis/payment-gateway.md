# Payment Gateway - DDD & EIP Analysis

## Current Responsibility

Payment Gateway owns saved payment methods, provider customer mappings, webhook normalization, and gateway adapter contracts. It wraps Paystack-specific behavior behind infrastructure adapters while domain/application code works with normalized payment outcomes.

## Domain Model

`PaymentMethod` is the aggregate root and `PaymentMethodId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/payment-gateway/
  domain/
    entities/
      PaymentMethod.ts
    value-objects/
      PaymentMethodId.ts
    errors/
      PaymentMethodInvariantError.ts
    events/
      PaymentMethodAddedEvent.ts
      PaymentMethodRemovedEvent.ts
      PaymentSucceededEvent.ts
      PaymentFailedEvent.ts
    repositories/
      IPaymentMethodRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      AddPaymentMethod/
        AddPaymentMethodCommand.ts
        AddPaymentMethodHandler.ts
      RemovePaymentMethod/
        RemovePaymentMethodCommand.ts
        RemovePaymentMethodHandler.ts
      InitializePayment/
        InitializePaymentCommand.ts
        InitializePaymentHandler.ts
      RecordWebhookEvent/
        RecordWebhookEventCommand.ts
        RecordWebhookEventHandler.ts
    queries/
      GetPaymentMethods/
        GetPaymentMethodsQuery.ts
        GetPaymentMethodsHandler.ts
    sagas/
      (none)
    event-handlers/
      OnPaymentSucceededCreditWalletHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaPaymentMethodRepository.ts
    mappers/
      PaymentMethodMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      PaymentGatewayResolver.ts
    graphql/
      PaymentMethodGraphQLType.type.ts
      PaymentInitializationGraphQLType.type.ts
      mappers/
        toPaymentMethodGraphQLType.ts
        toPaymentInitializationGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Payment Gateway invariants; persistence ignorant and reconstituted by repositories. */
class PaymentMethod extends AggregateRoot<PaymentMethodId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): PaymentMethod;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): PaymentMethod;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for PaymentMethod; prevents cross-aggregate ID mix-ups. */
class PaymentMethodId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): PaymentMethodId;
}

/** Base domain error for violated Payment Gateway invariants. */
class PaymentMethodInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by PaymentMethod after its state transition is persisted. */
class PaymentMethodAddedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: PaymentMethodId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by PaymentMethod after its state transition is persisted. */
class PaymentMethodRemovedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: PaymentMethodId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by PaymentMethod after its state transition is persisted. */
class PaymentSucceededEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: PaymentMethodId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by PaymentMethod after its state transition is persisted. */
class PaymentFailedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: PaymentMethodId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for PaymentMethod; domain/application depend on this contract, not Prisma. */
interface IPaymentMethodRepository {
  /** Loads an aggregate by ID. */
  findById(id: PaymentMethodId): Promise<PaymentMethod | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: PaymentMethod): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the AddPaymentMethod use case. */
class AddPaymentMethodCommand extends Command<PaymentMethodId> {
  /** Captures all input required by AddPaymentMethodHandler. */
  constructor(public readonly payload: AddPaymentMethodPayload);
}

/** Handles AddPaymentMethodCommand through the NestJS CommandBus. */
@CommandHandler(AddPaymentMethodCommand)
class AddPaymentMethodHandler implements ICommandHandler<AddPaymentMethodCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AddPaymentMethodCommand): Promise<PaymentMethodId>;
}

/** Command input for the RemovePaymentMethod use case. */
class RemovePaymentMethodCommand extends Command<void> {
  /** Captures all input required by RemovePaymentMethodHandler. */
  constructor(public readonly payload: RemovePaymentMethodPayload);
}

/** Handles RemovePaymentMethodCommand through the NestJS CommandBus. */
@CommandHandler(RemovePaymentMethodCommand)
class RemovePaymentMethodHandler implements ICommandHandler<RemovePaymentMethodCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RemovePaymentMethodCommand): Promise<void>;
}

/** Command input for the InitializePayment use case. */
class InitializePaymentCommand extends Command<PaymentInitializationDTO> {
  /** Captures all input required by InitializePaymentHandler. */
  constructor(public readonly payload: InitializePaymentPayload);
}

/** Handles InitializePaymentCommand through the NestJS CommandBus. */
@CommandHandler(InitializePaymentCommand)
class InitializePaymentHandler implements ICommandHandler<InitializePaymentCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: InitializePaymentCommand): Promise<PaymentInitializationDTO>;
}

/** Command input for the RecordWebhookEvent use case. */
class RecordWebhookEventCommand extends Command<void> {
  /** Captures all input required by RecordWebhookEventHandler. */
  constructor(public readonly payload: RecordWebhookEventPayload);
}

/** Handles RecordWebhookEventCommand through the NestJS CommandBus. */
@CommandHandler(RecordWebhookEventCommand)
class RecordWebhookEventHandler implements ICommandHandler<RecordWebhookEventCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RecordWebhookEventCommand): Promise<void>;
}

/** Query input for GetPaymentMethods. */
class GetPaymentMethodsQuery extends Query<PaymentMethodDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetPaymentMethodsPayload);
}

/** Handles GetPaymentMethodsQuery through the NestJS QueryBus. */
@QueryHandler(GetPaymentMethodsQuery)
class GetPaymentMethodsHandler implements IQueryHandler<GetPaymentMethodsQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetPaymentMethodsQuery): Promise<PaymentMethodDTO[]>;
}

/** Event handler for PaymentSucceededEvent; uses buses rather than handler classes. */
@EventsHandler(PaymentSucceededEvent)
class OnPaymentSucceededCreditWalletHandler implements IEventHandler<PaymentSucceededEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: PaymentSucceededEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IPaymentMethodRepository; maps rows through PaymentMethodMapper. */
@Injectable()
class PrismaPaymentMethodRepository implements IPaymentMethodRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: PaymentMethodId): Promise<PaymentMethod | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: PaymentMethod): Promise<void>;
}

/** Injectable mapper for PaymentMethod; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class PaymentMethodMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): PaymentMethod;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: PaymentMethod): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class PaymentGatewayResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for PaymentMethodGraphQLType; separate from application DTOs. */
type PaymentMethodGraphQLTypeShape = Omit<PaymentMethodDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class PaymentMethodGraphQLType implements PaymentMethodGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toPaymentMethodGraphQLType(dto: PaymentMethodDTO): PaymentMethodGraphQLType;

/** GraphQL shape for PaymentInitializationGraphQLType; separate from application DTOs. */
type PaymentInitializationGraphQLTypeShape = Omit<PaymentInitializationDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class PaymentInitializationGraphQLType implements PaymentInitializationGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toPaymentInitializationGraphQLType(dto: PaymentInitializationDTO): PaymentInitializationGraphQLType;

```

## EIP Patterns Applied

- **Canonical Data Model**: Gateway payloads are translated to normalized payment events before other modules consume them. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: Webhook event IDs and gateway references are stored uniquely before publishing PaymentSucceededEvent. Status: fully specced with concrete signatures in the Implementation Spec.
- **Dead Letter Channel**: Webhook processing failures are retried with raw payload, provider event ID, and gatewayReference for replay. Status: fully specced with concrete signatures in the Implementation Spec.
