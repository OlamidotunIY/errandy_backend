# Chat - DDD & EIP Analysis

## Current Responsibility

Chat owns conversation rooms, participants, messages, reactions, and read state. Message history is append-oriented and broadcast through PubSub after the message write succeeds.

## Bounded Context Assessment

Chat is a distinct bounded context because it owns conversation rooms, participants, messages, reactions, and read state. Other modules interact with it through typed IDs, commands, queries, and domain events; they do not write its persistence rows directly.

## Domain Model Audit

The current design centers on `ChatRoom` as the aggregate root and `ChatId` as the strongly typed identifier. Domain behavior belongs on the aggregate or on domain services listed in `domain/services`; DTOs, Prisma rows, GraphQL types, and external adapter payloads remain outside the domain model.

## Layering Violations

The corrected module shape keeps Prisma in `infrastructure/repositories`, GraphQL decorators in `presentation/graphql`, and orchestration in `application`. Resolvers use `CommandBus` and `QueryBus`; sagas, processors, and event handlers dispatch through buses instead of injecting handler classes or repositories across layer boundaries.

## Repository Pattern Gap

`IChatRoomRepository` is the application/domain boundary for persistence. The Prisma implementation belongs under `infrastructure/repositories`, and mapping is handled by injectable mapper classes so the domain layer stays persistence-ignorant.

## Cross-Cutting Concerns

Authorization is enforced at the resolver or command boundary before domain behavior runs. Logging, metrics, retries, and external adapters remain application/infrastructure concerns. Domain events are published only after the persistence write succeeds by pulling queued events from the aggregate.

## GraphQL-Specific Notes

GraphQL types are presentation models, not application DTOs. Any DTO field typed as an `EntityId` is converted to `string` through an explicit `presentation/graphql/mappers` function, using an `Omit<DTO, 'id'> & { id: string }` style override when needed.


## Domain Model

`ChatRoom` is the aggregate root and `ChatId` is the strongly typed aggregate identifier. References to other bounded contexts are stored as scalar IDs or value objects; cross-module behavior is coordinated through `CommandBus`, `QueryBus`, and `EventBus` rather than direct repository access.

Domain events are queued inside aggregates with `addDomainEvent()`. Application handlers call the repository first and publish events only after the write succeeds by iterating `aggregate.pullDomainEvents()` and calling `this.eventBus.publish(event)`.

## Persistence Model (Derived from Domain)

```prisma
model ChatRoom {
  id String @id @map("_id")
  errandId String?
  lastMessageId String?
  participantIds String[]
  archived Boolean
  createdAt DateTime
  updatedAt DateTime

  @@index([errandId])
  @@index([participantIds])
}

model Message {
  id String @id @map("_id")
  chatRoomId String
  senderId String
  body String?
  messageType MessageType
  createdAt DateTime

  @@index([chatRoomId, createdAt])
}

model MessageRead {
  id String @id @map("_id")
  messageId String
  userId String
  readAt DateTime

  @@unique([messageId, userId])
}
```

Scalar-ID references and cleanup owners:
- `errandId` references Errands. Cleanup owner: ErrandDeletedPolicyHandler archives or detaches errand chats through Chat commands.
- `lastMessageId` references Chat Message. Cleanup owner: DeleteMessageCommandHandler updates lastMessageId before removing a message if message deletion is allowed.
- `userId` references Users. Cleanup owner: UserDeletedPolicyHandler anonymizes participant and sender display data while preserving history.

Indexes and constraints mapped to repository methods/domain errors:
- `@@index([errandId])` maps to `findByErrandId / OnApplicationSubmittedCreateChatRoomHandler`; domain error: `none`.
- `@@index([participantIds])` maps to `ListUserChatRoomsQuery`; domain error: `none`.
- `Message @@index([chatRoomId, createdAt])` maps to `GetMessagesQuery`; domain error: `none`.
- `MessageRead @@unique([messageId, userId])` maps to `MarkMessageAsReadCommand`; domain error: `DuplicateReadReceiptError`.

## Migration Risk & Priority

Priority is high for fields or constraints that protect aggregate invariants and idempotency, especially unique constraints that back command safety. Migration should add indexes before switching read paths, backfill required scalar references and snapshots where applicable, then enable command handlers that rely on the new repository contracts.


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

/**
 * Aggregate root for Chat invariants; persistence ignorant and reconstituted by repositories.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
class ChatRoom extends AggregateRoot<ChatId> {
  /**
   * Creates a new `ChatRoom` aggregate.
   * 1. Validate required factory arguments.
   * 2. Normalize provided scalar IDs into value objects.
   * 3. Assign initial invariant-safe state and timestamps.
   * 4. Queue the module creation event with `this.addDomainEvent(event)` when the module emits one.
   * 5. Return the aggregate without calling Prisma or GraphQL code.
   */
  static create(...args: unknown[]): ChatRoom;

  /**
   * Rehydrates `ChatRoom` from persistence.
   * 1. Receive every persisted field listed in the Persistence Model.
   * 2. Convert persisted ID strings to the module value objects.
   * 3. Assign persisted scalar and embedded value-object state exactly as stored.
   * 4. Do not call `addDomainEvent()` during rehydration.
   * 5. Return the aggregate for command/query handlers.
   */
  static reconstitute(...args: unknown[]): ChatRoom;

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
 * Strongly typed identifier for ChatRoom; prevents cross-aggregate ID mix-ups.
 * Constructor fields:
 * - `value: string` is the persisted aggregate identifier.
 * 1. Validate `value` is non-empty.
 * 2. Wrap `value` in this EntityId subtype.
 * 3. Preserve the type boundary so IDs from other aggregates cannot be passed accidentally.
 */
class ChatId extends EntityId {
  /**
   * Builds an ID from a persisted string.
   * 1. Receive the raw string from Prisma, GraphQL input, or another module event.
   * 2. Validate the string is non-empty.
   * 3. Return the strongly typed EntityId instance.
   * 4. Throw the shared EntityId validation error when the string is invalid.
   */
  static fromString(value: string): ChatId;
}

/**
 * Base domain error for violated Chat invariants.
 * Constructor fields:
 * - `message: string` explains the violated invariant.
 * 1. Pass `message` to `Error`.
 * 2. Set the concrete error name for logs and tests.
 */
class ChatRoomInvariantError extends Error {
  /**
   * Creates the invariant error.
   * 1. Receive the invariant failure message.
   * 2. Call `super(message)`.
   * 3. Set `this.name` to the concrete error class name.
   */
  constructor(message: string);
}

/**
 * Domain event emitted by ChatRoom after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ChatRoomCreatedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by ChatRoom after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class MessageSentEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by ChatRoom after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class MessageReadEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by ChatRoom after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ParticipantAddedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Domain event emitted by ChatRoom after its state transition is persisted.
 * Constructor fields:
 * - aggregate/correlation ID fields identify the aggregate or external reference involved.
 * - scalar payload fields carry only data subscribers need.
 * - `occurredAt: Date` records the business event time when present.
 * 1. Store constructor arguments as readonly event payload fields.
 * 2. Do not read repositories or publish follow-up events from the event constructor.
 */
class ParticipantRemovedEvent implements DomainEvent {
  /**
   * Creates the event payload used by EventBus subscribers.
   * 1. Receive aggregate ID, occurrence time, and scalar payload values.
   * 2. Assign all fields as readonly properties.
   * 3. Keep payload values serializable for logging and async subscribers.
   */
  constructor(public readonly aggregateId: ChatId, public readonly occurredAt: Date, public readonly payload: Record<string, unknown>);
}

/**
 * Repository interface for ChatRoom; domain/application depend on this contract, not Prisma.
 * 1. // TODO: Expand this comment with the exact constructor fields or method steps once this declaration's field-level contract is finalized.
 * 2. Keep this declaration in the owning layer and do not move behavior across module boundaries.
 */
interface IChatRoomRepository {
  /**
   * Loads an aggregate by ID.
   * 1. Convert the typed ID to a string for the Prisma where clause.
   * 2. Execute the repository lookup backed by the Persistence Model index for `findById`.
   * 3. Return null when no row exists.
   * 4. Map the row with `ChatMapper.toDomain(row)` when present.
   */
  findById(id: ChatId): Promise<ChatRoom | null>;

  /**
   * Persists the aggregate in one durable write boundary.
   * 1. Convert the aggregate with `ChatMapper.toPersistence(aggregate)`.
   * 2. Execute the Prisma create/update/upsert for `ChatRoom`.
   * 3. Translate unique-constraint failures into the domain error named in the Persistence Model.
   * 4. Return after the durable write succeeds; do not publish events in the repository.
   */
  save(aggregate: ChatRoom): Promise<void>;
}

```

### Application Layer

```typescript

import { Command, CommandBus, CommandHandler, EventBus, EventsHandler, ICommandHandler, IEventHandler, IQueryHandler, Query, QueryBus, QueryHandler } from '@nestjs/cqrs';

/**
 * Command input for the CreateChatRoom use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class CreateChatRoomCommand extends Command<ChatId> {
  /**
   * Captures all input required by CreateChatRoomHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: CreateChatRoomPayload);
}

/**
 * Handles `CreateChatRoomCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` loads and saves `ChatRoom` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `ChatRoom` state through `chatRoomRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `ChatRoom.createChatRoom(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `chatRoomRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(CreateChatRoomCommand)
class CreateChatRoomHandler implements ICommandHandler<CreateChatRoomCommand> {
  /**
   * Executes `CreateChatRoomCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `ChatRoom` state with `chatRoomRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `ChatRoom` domain method for `CreateChatRoom` if not declared above.
   * 4. Persist with `chatRoomRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: CreateChatRoomCommand): Promise<ChatId>;
}

/**
 * Command input for the SendMessage use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class SendMessageCommand extends Command<MessageId> {
  /**
   * Captures all input required by SendMessageHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: SendMessagePayload);
}

/**
 * Handles `SendMessageCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` loads and saves `ChatRoom` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `ChatRoom` state through `chatRoomRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `ChatRoom.sendMessage(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `chatRoomRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(SendMessageCommand)
class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  /**
   * Executes `SendMessageCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `ChatRoom` state with `chatRoomRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `ChatRoom` domain method for `SendMessage` if not declared above.
   * 4. Persist with `chatRoomRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: SendMessageCommand): Promise<MessageId>;
}

/**
 * Command input for the MarkMessageAsRead use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class MarkMessageAsReadCommand extends Command<void> {
  /**
   * Captures all input required by MarkMessageAsReadHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: MarkMessageAsReadPayload);
}

/**
 * Handles `MarkMessageAsReadCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` loads and saves `ChatRoom` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `ChatRoom` state through `chatRoomRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `ChatRoom.markMessageAsRead(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `chatRoomRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(MarkMessageAsReadCommand)
class MarkMessageAsReadHandler implements ICommandHandler<MarkMessageAsReadCommand> {
  /**
   * Executes `MarkMessageAsReadCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `ChatRoom` state with `chatRoomRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `ChatRoom` domain method for `MarkMessageAsRead` if not declared above.
   * 4. Persist with `chatRoomRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: MarkMessageAsReadCommand): Promise<void>;
}

/**
 * Command input for the AddParticipant use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class AddParticipantCommand extends Command<void> {
  /**
   * Captures all input required by AddParticipantHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: AddParticipantPayload);
}

/**
 * Handles `AddParticipantCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` loads and saves `ChatRoom` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `ChatRoom` state through `chatRoomRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `ChatRoom.addParticipant(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `chatRoomRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(AddParticipantCommand)
class AddParticipantHandler implements ICommandHandler<AddParticipantCommand> {
  /**
   * Executes `AddParticipantCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `ChatRoom` state with `chatRoomRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `ChatRoom` domain method for `AddParticipant` if not declared above.
   * 4. Persist with `chatRoomRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: AddParticipantCommand): Promise<void>;
}

/**
 * Command input for the RemoveParticipant use case.
 * Constructor fields:
 * - fields shown in the constructor below are the complete command payload.
 * 1. Receive caller identity and business input from the resolver, saga, processor, or event handler.
 * 2. Store values as readonly fields.
 * 3. Let the corresponding handler validate invariants and load aggregates.
 */
class RemoveParticipantCommand extends Command<void> {
  /**
   * Captures all input required by RemoveParticipantHandler.
   * 1. Receive the use-case payload from the caller.
   * 2. Store it as readonly command state.
   * 3. Do not perform repository reads from the command constructor.
   */
  constructor(public readonly payload: RemoveParticipantPayload);
}

/**
 * Handles `RemoveParticipantCommand` through the NestJS CommandBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` loads and saves `ChatRoom` aggregate state.
 * - `eventBus: EventBus` publishes domain events after persistence succeeds.
 * - `commandBus: CommandBus` is used only by sagas/event processors that dispatch follow-up commands.
 * 1. Validate the command payload and caller identity fields.
 * 2. Load required `ChatRoom` state through `chatRoomRepository` using the command's typed ID fields.
 * 3. // TODO: Confirm the exact `ChatRoom.removeParticipant(...)` domain method signature if it is not already declared in the Domain Layer.
 * 4. Persist the aggregate or records through `chatRoomRepository.save(aggregate)`.
 * 5. Translate repository unique-constraint failures into the module domain error named in Persistence Model.
 * 6. After save succeeds, call `aggregate.pullDomainEvents()`.
 * 7. Publish each event with `eventBus.publish(event)`.
 */
@CommandHandler(RemoveParticipantCommand)
class RemoveParticipantHandler implements ICommandHandler<RemoveParticipantCommand> {
  /**
   * Executes `RemoveParticipantCommand`.
   * 1. Validate `command.payload` and typed IDs.
   * 2. Load `ChatRoom` state with `chatRoomRepository.findById(...)` when the command targets an existing aggregate.
   * 3. // TODO: Confirm exact `ChatRoom` domain method for `RemoveParticipant` if not declared above.
   * 4. Persist with `chatRoomRepository.save(aggregate)`.
   * 5. Call `aggregate.pullDomainEvents()` only after save succeeds.
   * 6. Publish events with `eventBus.publish(event)`.
   */
  async execute(command: RemoveParticipantCommand): Promise<void>;
}

/**
 * Query input for GetChatRoom.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetChatRoomQuery extends Query<ChatRoomDTO | null> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetChatRoomPayload);
}

/**
 * Handles `GetChatRoomQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` reads `ChatRoom` persistence state.
 * - `ChatMapper: ChatMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `chatRoomRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ChatMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetChatRoomQuery)
class GetChatRoomHandler implements IQueryHandler<GetChatRoomQuery> {
  /**
   * Executes `GetChatRoomQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `chatRoomRepository` or the module read model.
   * 3. Map rows with `ChatMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetChatRoomQuery): Promise<ChatRoomDTO | null>;
}

/**
 * Query input for ListUserChatRooms.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class ListUserChatRoomsQuery extends Query<ChatRoomDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: ListUserChatRoomsPayload);
}

/**
 * Handles `ListUserChatRoomsQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` reads `ChatRoom` persistence state.
 * - `ChatMapper: ChatMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `chatRoomRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ChatMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(ListUserChatRoomsQuery)
class ListUserChatRoomsHandler implements IQueryHandler<ListUserChatRoomsQuery> {
  /**
   * Executes `ListUserChatRoomsQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `chatRoomRepository` or the module read model.
   * 3. Map rows with `ChatMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: ListUserChatRoomsQuery): Promise<ChatRoomDTO[]>;
}

/**
 * Query input for GetMessages.
 * Constructor fields:
 * - fields shown in the constructor below are the complete query payload.
 * 1. Receive caller identity, filters, and pagination input.
 * 2. Store values as readonly query state.
 * 3. Leave repository reads and DTO mapping to the query handler.
 */
class GetMessagesQuery extends Query<MessageDTO[]> {
  /**
   * Captures all filters, pagination, and caller identity for the query.
   * 1. Receive filter, pagination, and caller identity values.
   * 2. Store values as readonly query payload.
   * 3. Do not perform authorization or persistence work in the query constructor.
   */
  constructor(public readonly payload: GetMessagesPayload);
}

/**
 * Handles `GetMessagesQuery` through the NestJS QueryBus.
 * Constructor dependencies:
 * - `chatRoomRepository: IChatRoomRepository` reads `ChatRoom` persistence state.
 * - `ChatMapper: ChatMapper` converts domain/read rows to application DTOs.
 * 1. Validate query filters, pagination, and authenticated caller identity.
 * 2. Read data through `chatRoomRepository` or the module read-model repository named in the Persistence Model.
 * 3. Scope the read to the caller IDs carried by the query.
 * 4. Convert domain/read rows to application DTOs with `ChatMapper`.
 * 5. Return DTOs only; do not return Prisma rows or GraphQL types.
 */
@QueryHandler(GetMessagesQuery)
class GetMessagesHandler implements IQueryHandler<GetMessagesQuery> {
  /**
   * Executes `GetMessagesQuery`.
   * 1. Validate query filters, pagination, and caller identity.
   * 2. Read via `chatRoomRepository` or the module read model.
   * 3. Map rows with `ChatMapper`.
   * 4. Return application DTOs only.
   */
  async execute(query: GetMessagesQuery): Promise<MessageDTO[]>;
}

/**
 * Event handler for `MessageSentEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `MessageSentEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(MessageSentEvent)
class OnMessageSentBroadcastHandler implements IEventHandler<MessageSentEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: MessageSentEvent): Promise<void>;
}

/**
 * Event handler for `ApplicationSubmittedEvent`.
 * Constructor dependencies:
 * - `commandBus: CommandBus` dispatches follow-up commands.
 * - `queryBus: QueryBus` fetches read data when needed.
 * 1. Receive `ApplicationSubmittedEvent` from `EventBus`.
 * 2. Read event IDs and payload fields.
 * 3. Build the exact follow-up command/query from event fields.
 * 4. Dispatch with `commandBus.execute(new XCommand(...))` or `queryBus.execute(new XQuery(...))`.
 * 5. Do not inject handler classes or write another module's repository directly.
 */
@EventsHandler(ApplicationSubmittedEvent)
class OnApplicationSubmittedCreateChatRoomHandler implements IEventHandler<ApplicationSubmittedEvent> {
  /**
   * Handles the event through CQRS buses.
   * 1. Validate event correlation IDs.
   * 2. Dispatch the documented command/query.
   * 3. Let the downstream handler own persistence and event publication.
   */
  async handle(event: ApplicationSubmittedEvent): Promise<void>;
}

```

### Infrastructure And Presentation Layers

```typescript

/**
 * Prisma implementation of IChatRoomRepository; maps rows through ChatMapper.
 * Constructor dependencies:
 * - `prisma: PrismaService` executes database operations.
 * - mapper dependency converts rows to domain objects and back.
 * 1. Keep Prisma calls inside this infrastructure class.
 * 2. Translate known persistence errors into domain errors.
 */
@Injectable()
class PrismaChatRoomRepository implements IChatRoomRepository {
  /**
   * Loads and maps a persistence row to the domain aggregate.
   * 1. Convert the typed ID to a string where clause.
   * 2. Call the matching Prisma read method.
   * 3. Return null if no row exists.
   * 4. Map the row with the module mapper when present.
   */
  async findById(id: ChatId): Promise<ChatRoom | null>;

  /**
   * Persists aggregate state without publishing events itself.
   * 1. Convert the aggregate with the module mapper.
   * 2. Execute Prisma create/update/upsert.
   * 3. Translate known unique-constraint failures into domain errors.
   * 4. Return after the durable write succeeds.
   */
  async save(aggregate: ChatRoom): Promise<void>;
}

/**
 * Injectable mapper for `ChatRoom`; uses DI for nested mappers and avoids static conversion helpers.
 * Constructor dependencies:
 * - nested mapper dependencies convert owned child entities/value objects when the aggregate contains them.
 * `toDomain(row)` converts persistence rows to `ChatRoom.reconstitute(...)` inputs.
 * `toPersistence(aggregate)` flattens EntityId values with `.toString()` for Prisma.
 */
@Injectable()
class ChatMapper {
  /**
   * Converts a Prisma row into a domain aggregate.
   * 1. Read scalar fields from the row.
   * 2. Convert ID strings with the appropriate `fromString()` methods.
   * 3. Call the aggregate `reconstitute(...)` factory.
   * 4. Return the aggregate without adding domain events.
   */
  toDomain(row: unknown): ChatRoom;

  /**
   * Converts a domain aggregate into persistence data.
   * 1. Read aggregate fields and value objects.
   * 2. Convert EntityId values with `.toString()`.
   * 3. Return a Prisma data object.
   * 4. Do not call repositories or publish events.
   */
  toPersistence(aggregate: ChatRoom): unknown;
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
class ChatResolver {
  /**
   * Creates the resolver with CQRS buses.
   * 1. Store `commandBus` for mutation dispatch.
   * 2. Store `queryBus` for query dispatch.
   * 3. Do not inject repositories into the resolver.
   */
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus);
}

/**
 * GraphQL shape for ChatRoomGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type ChatRoomGraphQLTypeShape = Omit<ChatRoomDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class ChatRoomGraphQLType implements ChatRoomGraphQLTypeShape {
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
function toChatRoomGraphQLType(dto: ChatRoomDTO): ChatRoomGraphQLType;

/**
 * GraphQL shape for MessageGraphQLType; separate from application DTOs.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
type MessageGraphQLTypeShape = Omit<MessageDTO, 'id'> & { id: string };

/**
 * Presentation type exposed by GraphQL decorators.
 * 1. Represent the application DTO as a GraphQL-decorated presentation type.
 * 2. Convert EntityId fields to strings before exposing them through GraphQL.
 * 3. Keep this type separate from domain entities and application DTOs.
 */
@ObjectType()
class MessageGraphQLType implements MessageGraphQLTypeShape {
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
function toMessageGraphQLType(dto: MessageDTO): MessageGraphQLType;

```

## EIP Patterns Applied

- **Publish-Subscribe Channel**: MessageSentEvent is published after persistence and broadcast to subscribers by an event handler. Status: fully specced with concrete signatures in the Implementation Spec.
- **Idempotent Receiver**: CreateChatRoom uses errand/application participant uniqueness to avoid duplicate rooms. Status: fully specced with concrete signatures in the Implementation Spec.
- **Content-Based Router**: Chat queries route by participant, errand, and room membership without leaking room internals. Status: fully specced with concrete signatures in the Implementation Spec.
