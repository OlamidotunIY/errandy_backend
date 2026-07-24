# Application - DDD & EIP Analysis

## Current Responsibility

Application owns provider applications to errands, including submission, acceptance, rejection, cancellation, and one-application-per-worker-per-errand uniqueness. Acceptance starts the cross-module funding and assignment workflow but Application does not charge payments or assign errands itself.

## Domain Model

`Application` is the aggregate root and `ApplicationId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/application/
  domain/
    entities/
      Application.ts
    value-objects/
      ApplicationId.ts
    errors/
      ApplicationInvariantError.ts
    events/
      ApplicationSubmittedEvent.ts
      ApplicationAcceptedEvent.ts
      ApplicationRejectedEvent.ts
      ApplicationCancelledEvent.ts
      ApplicationAcceptanceFailedEvent.ts
    repositories/
      IApplicationRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      SubmitApplication/
        SubmitApplicationCommand.ts
        SubmitApplicationHandler.ts
      AcceptApplication/
        AcceptApplicationCommand.ts
        AcceptApplicationHandler.ts
      RejectApplication/
        RejectApplicationCommand.ts
        RejectApplicationHandler.ts
      CancelApplication/
        CancelApplicationCommand.ts
        CancelApplicationHandler.ts
      CancelOtherApplications/
        CancelOtherApplicationsCommand.ts
        CancelOtherApplicationsHandler.ts
    queries/
      GetApplication/
        GetApplicationQuery.ts
        GetApplicationHandler.ts
      ListErrandApplications/
        ListErrandApplicationsQuery.ts
        ListErrandApplicationsHandler.ts
      GetMyApplication/
        GetMyApplicationQuery.ts
        GetMyApplicationHandler.ts
      GetApplicationSummary/
        GetApplicationSummaryQuery.ts
        GetApplicationSummaryHandler.ts
    sagas/
      AcceptApplicationSaga.ts
    event-handlers/
      (none)
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaApplicationRepository.ts
    mappers/
      ApplicationMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      ApplicationResolver.ts
    graphql/
      ApplicationGraphQLType.type.ts
      ApplicationSummaryGraphQLType.type.ts
      mappers/
        toApplicationGraphQLType.ts
        toApplicationSummaryGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Application invariants; persistence ignorant and reconstituted by repositories. */
class Application extends AggregateRoot<ApplicationId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): Application;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): Application;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for Application; prevents cross-aggregate ID mix-ups. */
class ApplicationId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): ApplicationId;
}

/** Base domain error for violated Application invariants. */
class ApplicationInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by Application after its state transition is persisted. */
class ApplicationSubmittedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ApplicationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Application after its state transition is persisted. */
class ApplicationAcceptedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ApplicationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Application after its state transition is persisted. */
class ApplicationRejectedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ApplicationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Application after its state transition is persisted. */
class ApplicationCancelledEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ApplicationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by Application after its state transition is persisted. */
class ApplicationAcceptanceFailedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ApplicationId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for Application; domain/application depend on this contract, not Prisma. */
interface IApplicationRepository {
  /** Loads an aggregate by ID. */
  findById(id: ApplicationId): Promise<Application | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: Application): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the SubmitApplication use case. */
class SubmitApplicationCommand extends Command<ApplicationId> {
  /** Captures all input required by SubmitApplicationHandler. */
  constructor(public readonly payload: SubmitApplicationPayload);
}

/** Handles SubmitApplicationCommand through the NestJS CommandBus. */
@CommandHandler(SubmitApplicationCommand)
class SubmitApplicationHandler implements ICommandHandler<SubmitApplicationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: SubmitApplicationCommand): Promise<ApplicationId>;
}

/** Command input for the AcceptApplication use case. */
class AcceptApplicationCommand extends Command<void> {
  /** Captures all input required by AcceptApplicationHandler. */
  constructor(public readonly payload: AcceptApplicationPayload);
}

/** Handles AcceptApplicationCommand through the NestJS CommandBus. */
@CommandHandler(AcceptApplicationCommand)
class AcceptApplicationHandler implements ICommandHandler<AcceptApplicationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AcceptApplicationCommand): Promise<void>;
}

/** Command input for the RejectApplication use case. */
class RejectApplicationCommand extends Command<void> {
  /** Captures all input required by RejectApplicationHandler. */
  constructor(public readonly payload: RejectApplicationPayload);
}

/** Handles RejectApplicationCommand through the NestJS CommandBus. */
@CommandHandler(RejectApplicationCommand)
class RejectApplicationHandler implements ICommandHandler<RejectApplicationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RejectApplicationCommand): Promise<void>;
}

/** Command input for the CancelApplication use case. */
class CancelApplicationCommand extends Command<void> {
  /** Captures all input required by CancelApplicationHandler. */
  constructor(public readonly payload: CancelApplicationPayload);
}

/** Handles CancelApplicationCommand through the NestJS CommandBus. */
@CommandHandler(CancelApplicationCommand)
class CancelApplicationHandler implements ICommandHandler<CancelApplicationCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CancelApplicationCommand): Promise<void>;
}

/** Command input for the CancelOtherApplications use case. */
class CancelOtherApplicationsCommand extends Command<void> {
  /** Captures all input required by CancelOtherApplicationsHandler. */
  constructor(public readonly payload: CancelOtherApplicationsPayload);
}

/** Handles CancelOtherApplicationsCommand through the NestJS CommandBus. */
@CommandHandler(CancelOtherApplicationsCommand)
class CancelOtherApplicationsHandler implements ICommandHandler<CancelOtherApplicationsCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CancelOtherApplicationsCommand): Promise<void>;
}

/** Query input for GetApplication. */
class GetApplicationQuery extends Query<ApplicationDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetApplicationPayload);
}

/** Handles GetApplicationQuery through the NestJS QueryBus. */
@QueryHandler(GetApplicationQuery)
class GetApplicationHandler implements IQueryHandler<GetApplicationQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetApplicationQuery): Promise<ApplicationDTO | null>;
}

/** Query input for ListErrandApplications. */
class ListErrandApplicationsQuery extends Query<ApplicationDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: ListErrandApplicationsPayload);
}

/** Handles ListErrandApplicationsQuery through the NestJS QueryBus. */
@QueryHandler(ListErrandApplicationsQuery)
class ListErrandApplicationsHandler implements IQueryHandler<ListErrandApplicationsQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: ListErrandApplicationsQuery): Promise<ApplicationDTO[]>;
}

/** Query input for GetMyApplication. */
class GetMyApplicationQuery extends Query<ApplicationDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetMyApplicationPayload);
}

/** Handles GetMyApplicationQuery through the NestJS QueryBus. */
@QueryHandler(GetMyApplicationQuery)
class GetMyApplicationHandler implements IQueryHandler<GetMyApplicationQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetMyApplicationQuery): Promise<ApplicationDTO | null>;
}

/** Query input for GetApplicationSummary. */
class GetApplicationSummaryQuery extends Query<ApplicationSummaryDTO> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetApplicationSummaryPayload);
}

/** Handles GetApplicationSummaryQuery through the NestJS QueryBus. */
@QueryHandler(GetApplicationSummaryQuery)
class GetApplicationSummaryHandler implements IQueryHandler<GetApplicationSummaryQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetApplicationSummaryQuery): Promise<ApplicationSummaryDTO>;
}

/** Process manager that reacts to ApplicationAcceptedEvent and dispatches follow-up commands through CommandBus. */
class AcceptApplicationSaga {
  /** Creates the saga with CommandBus, EventBus, and logger dependencies. */
  constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus);

  /** Handles the triggering event and dispatches commands with commandBus.execute(new XCommand(...)). */
  async handle(event: ApplicationAcceptedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IApplicationRepository; maps rows through ApplicationMapper. */
@Injectable()
class PrismaApplicationRepository implements IApplicationRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: ApplicationId): Promise<Application | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: Application): Promise<void>;
}

/** Injectable mapper for Application; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class ApplicationMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): Application;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: Application): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class ApplicationResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for ApplicationGraphQLType; separate from application DTOs. */
type ApplicationGraphQLTypeShape = Omit<ApplicationDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ApplicationGraphQLType implements ApplicationGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toApplicationGraphQLType(dto: ApplicationDTO): ApplicationGraphQLType;

/** GraphQL shape for ApplicationSummaryGraphQLType; separate from application DTOs. */
type ApplicationSummaryGraphQLTypeShape = Omit<ApplicationSummaryDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ApplicationSummaryGraphQLType implements ApplicationSummaryGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toApplicationSummaryGraphQLType(dto: ApplicationSummaryDTO): ApplicationSummaryGraphQLType;

```

## EIP Patterns Applied

- **Saga / Process Manager**: AcceptApplicationSaga coordinates Escrow funding, Errand assignment, and cancellation of competing applications. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: The errandId/workerId unique constraint prevents duplicate applications for the same errand. Status: fully specced with concrete signatures in the Implementation Spec.
