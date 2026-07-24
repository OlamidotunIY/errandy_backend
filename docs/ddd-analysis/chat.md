# Chat - DDD & EIP Analysis

## Current Responsibility

Chat owns conversation rooms, participants, messages, reactions, and read state. Message history is append-oriented and broadcast through PubSub after the message write succeeds.

## Domain Model

`ChatRoom` is the aggregate root and `ChatId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Target Structure

```text
src/chat/
  domain/
    entities/
      ChatRoom.ts
    value-objects/
      ChatId.ts
    errors/
      ChatRoomInvariantError.ts
    events/
      ChatRoomCreatedEvent.ts
      MessageSentEvent.ts
      MessageReadEvent.ts
      ParticipantAddedEvent.ts
      ParticipantRemovedEvent.ts
    repositories/
      IChatRoomRepository.ts
    services/
      (domain services only when invariants span value objects)
  application/
    commands/
      CreateChatRoom/
        CreateChatRoomCommand.ts
        CreateChatRoomHandler.ts
      SendMessage/
        SendMessageCommand.ts
        SendMessageHandler.ts
      MarkMessageAsRead/
        MarkMessageAsReadCommand.ts
        MarkMessageAsReadHandler.ts
      AddParticipant/
        AddParticipantCommand.ts
        AddParticipantHandler.ts
      RemoveParticipant/
        RemoveParticipantCommand.ts
        RemoveParticipantHandler.ts
    queries/
      GetChatRoom/
        GetChatRoomQuery.ts
        GetChatRoomHandler.ts
      ListUserChatRooms/
        ListUserChatRoomsQuery.ts
        ListUserChatRoomsHandler.ts
      GetMessages/
        GetMessagesQuery.ts
        GetMessagesHandler.ts
    sagas/
      (none)
    event-handlers/
      OnMessageSentBroadcastHandler.ts
      OnApplicationSubmittedCreateChatRoomHandler.ts
    jobs/
      (none)
  infrastructure/
    repositories/
      PrismaChatRoomRepository.ts
    mappers/
      ChatMapper.ts
    adapters/
      (external adapters only when required)
  presentation/
    resolvers/
      ChatResolver.ts
    graphql/
      ChatRoomGraphQLType.type.ts
      MessageGraphQLType.type.ts
      mappers/
        toChatRoomGraphQLType.ts
        toMessageGraphQLType.ts
```

## Implementation Spec

### Domain Layer

```typescript

/** Aggregate root for Chat invariants; persistence ignorant and reconstituted by repositories. */
class ChatRoom extends AggregateRoot<ChatId> {
  /** Creates a new aggregate and records creation events where the module emits them. */
  static create(...args: unknown[]): ChatRoom;

  /** Rehydrates an aggregate from persistence without recording new domain events. */
  static reconstitute(...args: unknown[]): ChatRoom;

  /** Returns and clears queued domain events after a successful repository write. */
  pullDomainEvents(): DomainEvent[];
}

/** Strongly typed identifier for ChatRoom; prevents cross-aggregate ID mix-ups. */
class ChatId extends EntityId {
  /** Builds an ID from a persisted string. */
  static fromString(value: string): ChatId;
}

/** Base domain error for violated Chat invariants. */
class ChatRoomInvariantError extends Error {
  /** Creates the invariant error. */
  constructor(message: string);
}

/** Domain event emitted by ChatRoom after its state transition is persisted. */
class ChatRoomCreatedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by ChatRoom after its state transition is persisted. */
class MessageSentEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by ChatRoom after its state transition is persisted. */
class MessageReadEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by ChatRoom after its state transition is persisted. */
class ParticipantAddedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Domain event emitted by ChatRoom after its state transition is persisted. */
class ParticipantRemovedEvent implements DomainEvent {
  /** Creates the event payload used by EventBus subscribers. */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/** Repository interface for ChatRoom; domain/application depend on this contract, not Prisma. */
interface IChatRoomRepository {
  /** Loads an aggregate by ID. */
  findById(id: ChatId): Promise<ChatRoom | null>;

  /** Persists the aggregate in one durable write boundary. */
  save(aggregate: ChatRoom): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/** Command input for the CreateChatRoom use case. */
class CreateChatRoomCommand extends Command<ChatId> {
  /** Captures all input required by CreateChatRoomHandler. */
  constructor(public readonly payload: CreateChatRoomPayload);
}

/** Handles CreateChatRoomCommand through the NestJS CommandBus. */
@CommandHandler(CreateChatRoomCommand)
class CreateChatRoomHandler implements ICommandHandler<CreateChatRoomCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: CreateChatRoomCommand): Promise<ChatId>;
}

/** Command input for the SendMessage use case. */
class SendMessageCommand extends Command<MessageId> {
  /** Captures all input required by SendMessageHandler. */
  constructor(public readonly payload: SendMessagePayload);
}

/** Handles SendMessageCommand through the NestJS CommandBus. */
@CommandHandler(SendMessageCommand)
class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: SendMessageCommand): Promise<MessageId>;
}

/** Command input for the MarkMessageAsRead use case. */
class MarkMessageAsReadCommand extends Command<void> {
  /** Captures all input required by MarkMessageAsReadHandler. */
  constructor(public readonly payload: MarkMessageAsReadPayload);
}

/** Handles MarkMessageAsReadCommand through the NestJS CommandBus. */
@CommandHandler(MarkMessageAsReadCommand)
class MarkMessageAsReadHandler implements ICommandHandler<MarkMessageAsReadCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: MarkMessageAsReadCommand): Promise<void>;
}

/** Command input for the AddParticipant use case. */
class AddParticipantCommand extends Command<void> {
  /** Captures all input required by AddParticipantHandler. */
  constructor(public readonly payload: AddParticipantPayload);
}

/** Handles AddParticipantCommand through the NestJS CommandBus. */
@CommandHandler(AddParticipantCommand)
class AddParticipantHandler implements ICommandHandler<AddParticipantCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: AddParticipantCommand): Promise<void>;
}

/** Command input for the RemoveParticipant use case. */
class RemoveParticipantCommand extends Command<void> {
  /** Captures all input required by RemoveParticipantHandler. */
  constructor(public readonly payload: RemoveParticipantPayload);
}

/** Handles RemoveParticipantCommand through the NestJS CommandBus. */
@CommandHandler(RemoveParticipantCommand)
class RemoveParticipantHandler implements ICommandHandler<RemoveParticipantCommand> {
  /** Executes the use case, persists aggregates first, then publishes aggregate.pullDomainEvents(). */
  async execute(command: RemoveParticipantCommand): Promise<void>;
}

/** Query input for GetChatRoom. */
class GetChatRoomQuery extends Query<ChatRoomDTO | null> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetChatRoomPayload);
}

/** Handles GetChatRoomQuery through the NestJS QueryBus. */
@QueryHandler(GetChatRoomQuery)
class GetChatRoomHandler implements IQueryHandler<GetChatRoomQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetChatRoomQuery): Promise<ChatRoomDTO | null>;
}

/** Query input for ListUserChatRooms. */
class ListUserChatRoomsQuery extends Query<ChatRoomDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: ListUserChatRoomsPayload);
}

/** Handles ListUserChatRoomsQuery through the NestJS QueryBus. */
@QueryHandler(ListUserChatRoomsQuery)
class ListUserChatRoomsHandler implements IQueryHandler<ListUserChatRoomsQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: ListUserChatRoomsQuery): Promise<ChatRoomDTO[]>;
}

/** Query input for GetMessages. */
class GetMessagesQuery extends Query<MessageDTO[]> {
  /** Captures all filters, pagination, and caller identity for the query. */
  constructor(public readonly payload: GetMessagesPayload);
}

/** Handles GetMessagesQuery through the NestJS QueryBus. */
@QueryHandler(GetMessagesQuery)
class GetMessagesHandler implements IQueryHandler<GetMessagesQuery> {
  /** Returns an application DTO, never a GraphQL type or Prisma row. */
  async execute(query: GetMessagesQuery): Promise<MessageDTO[]>;
}

/** Event handler for MessageSentEvent; uses buses rather than handler classes. */
@EventsHandler(MessageSentEvent)
class OnMessageSentBroadcastHandler implements IEventHandler<MessageSentEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: MessageSentEvent): Promise<void>;
}

/** Event handler for ApplicationSubmittedEvent; uses buses rather than handler classes. */
@EventsHandler(ApplicationSubmittedEvent)
class OnApplicationSubmittedCreateChatRoomHandler implements IEventHandler<ApplicationSubmittedEvent> {
  /** Reacts to the event by dispatching commands/queries through the buses. */
  async handle(event: ApplicationSubmittedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/** Prisma implementation of IChatRoomRepository; maps rows through ChatMapper. */
@Injectable()
class PrismaChatRoomRepository implements IChatRoomRepository {
  /** Loads and maps a persistence row to the domain aggregate. */
  async findById(id: ChatId): Promise<ChatRoom | null>;

  /** Persists aggregate state without publishing events itself. */
  async save(aggregate: ChatRoom): Promise<void>;
}

/** Injectable mapper for ChatRoom; uses DI for nested mappers and avoids static conversion helpers. */
@Injectable()
class ChatMapper {
  /** Converts a Prisma row into a domain aggregate. */
  toDomain(row: unknown): ChatRoom;

  /** Converts a domain aggregate into persistence data. */
  toPersistence(aggregate: ChatRoom): unknown;
}

/** GraphQL resolver; injects CommandBus and QueryBus, never repositories. */
@Resolver()
class ChatResolver {
  /** Creates the resolver with CQRS buses. */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/** GraphQL shape for ChatRoomGraphQLType; separate from application DTOs. */
type ChatRoomGraphQLTypeShape = Omit<ChatRoomDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class ChatRoomGraphQLType implements ChatRoomGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toChatRoomGraphQLType(dto: ChatRoomDTO): ChatRoomGraphQLType;

/** GraphQL shape for MessageGraphQLType; separate from application DTOs. */
type MessageGraphQLTypeShape = Omit<MessageDTO, 'id'> & { id: string };

/** Presentation type exposed by GraphQL decorators. */
@ObjectType()
class MessageGraphQLType implements MessageGraphQLTypeShape {
  /** String form of the strongly typed aggregate ID. */
  @Field() id: string;
}

/** Converts application DTOs to GraphQL types, including EntityId-to-string fields. */
function toMessageGraphQLType(dto: MessageDTO): MessageGraphQLType;

```

## EIP Patterns Applied

- **Publish-Subscribe Channel**: MessageSentEvent is published after persistence and broadcast to subscribers by an event handler. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: CreateChatRoom uses errand/application participant uniqueness to avoid duplicate rooms. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Chat queries route by participant, errand, and room membership without leaking room internals. Status: fully specced with concrete signatures in the Implementation Spec.
