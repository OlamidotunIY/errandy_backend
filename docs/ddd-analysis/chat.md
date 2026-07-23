# Chat — DDD & EIP Analysis

## 1. Current Responsibility

Manages real-time messaging between users:

- Chat room creation/fetching: `getOrCreateChat` (upsert room by normalized participant IDs).
- Message sending: `sendMessage` with file upload support (images, audio, video via Firebase Storage).
- Message type handling: TEXT, IMAGE, AUDIO, VIDEO, FILE.
- Real-time broadcasting: Publishes messages to PubSub (`messageSent` subscription).
- Unread count tracking.

**Files**: `chat.service.ts` (~200 lines), `chat.resolver.ts`, `chat.module.ts`.

## 2. Bounded Context Assessment

**This is a standalone bounded context** for "Messaging & Communication".

- Chat is **generic** — not specific to errands. Users can chat about anything.
- However, in practice, chat rooms are likely created in the context of errands (client-provider communication about a job).

**Overlaps**:

- **Errands**: Chats are probably initiated when a provider applies to an errand or gets assigned — but no explicit link (no `errandId` in ChatRoom model).
- **Users**: ChatRoom has `participantIds` (array of user IDs) — tight coupling to User aggregate.
- **Firebase**: File uploads use `FirebaseStorageService` (line 13) — infrastructure dependency.
- **PubSub**: Real-time broadcasting uses `PubSubService` (line 14) — infrastructure dependency.

**Verdict**: Chat is a **supporting bounded context** for collaboration. Should remain separate (don't merge with Errands).

## 3. Domain Model Audit

**Anemic models**:

- `ChatRoom` (Prisma model) is a data bag with `participantIds`, `roomKey`, `messages`, `lastMessage`.
  - No behavior: No `ChatRoom.addParticipant()`, `ChatRoom.sendMessage()` methods.
- `Message` (Prisma model) is a data bag with `content`, `senderId`, `type`, `seen`, `delivered`, `sent`.
  - No behavior: No `Message.markAsRead()`, `Message.markAsDelivered()` methods.

**Aggregate boundaries**:

- **`ChatRoom`** should be the aggregate root, owning:
  - `Message` (child entity — messages belong to room).
  - Invariants: Participants must be valid users, room key is unique, lastMessage is always most recent message.
- **Message operations**:
  - `sendMessage()` method on ChatRoom (not on Message — message cannot exist without room).
  - `markMessageAsRead()` method on ChatRoom (updates message status).

**Invariants currently unenforced**:

1. **Participant validation**:
   - `sendMessage` checks if sender is a participant (line 103-105), but this is in service layer, not domain.
   - No guard preventing non-participants from reading messages.
2. **Message type constraints**:
   - TEXT messages must have `content` (line 115-117), other types must have `contentUrl` (line 119-122).
   - Validation is scattered in service — should be in Message value object.
3. **File upload validation**:
   - `validateMimeTypeForMessageType` (line 111) checks MIME type, but implementation not seen.
   - If validation fails, file is already uploaded to Firebase Storage — orphaned file (cleanup?).
4. **Unread count consistency**:
   - `getUserChats` (line 20) calculates unread count via `_count` aggregation.
   - This is computed on the fly — if message `seen` flag is updated outside service (direct Prisma call), count becomes stale.

## 4. Layering Violations

**Business logic in service**:

- `sendMessage` (line 94-173+) orchestrates:
  1. File upload (infrastructure: Firebase Storage).
  2. MIME type validation (application logic).
  3. Message creation (domain operation).
  4. PubSub broadcast (infrastructure: real-time messaging).

  This is an **application service use case**, not a domain service. Should be `SendMessageCommandHandler`.

**Infrastructure in service**:

- `firebaseStorageService.uploadChatAttachment` (line 113) — direct infrastructure call in service layer.
- `pubSub.publish` (line 171+) — direct infrastructure call in service layer.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.chatRoom.*`, `this.prisma.message.*`).
- No repository abstraction.

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IChatRoomRepository (interface)
    - findById(id): ChatRoom | null
    - findByRoomKey(roomKey): ChatRoom | null
    - findByParticipant(userId): ChatRoom[]
    - save(chatRoom): void
  IMessageRepository (interface)
    - findById(id): Message | null
    - findByRoom(roomId, pagination): Message[]
    - save(message): void
infrastructure/
  PrismaChatRoomRepository (implementation)
  PrismaMessageRepository (implementation)
```

**Consolidation**: All `prisma.chatRoom.*` and `prisma.message.*` calls move to repositories.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **MessageSent event**:
   - Current: `sendMessage` publishes to PubSub inline (line 171+).
   - Proposed: Emit `MessageSent` domain event → event handler publishes to PubSub.
   - Benefits: Decouples domain logic from real-time infrastructure.

2. **MessageRead event**:
   - Not currently implemented, but should be:
     - When user views a message, emit `MessageRead` event.
     - Listeners:
       - Update message `seen` flag.
       - Broadcast read receipt to other participants.
       - Update unread count.

3. **ChatRoomCreated event**:
   - When room is created, emit event.
   - Listeners:
     - Notification sends "chat started" push notification.
     - Analytics tracks chat engagement.

**Message Channel (PubSub)**:

- Current: Uses PubSub for real-time message broadcasting (`messageSent:${userId}` subscription).
- This is correct usage of PubSub for WebSocket subscriptions (GraphQL subscriptions).
- However, PubSub is in-memory (Redis) — if server restarts, in-flight messages are lost.
- Recommendation: For critical messages (escrow notifications), use BullMQ in addition to PubSub (persistent queue).

**Dead Letter / Retry**:

- File upload (line 113) can fail (Firebase timeout).
  - No retry — user sees error and must resend message.
  - Uploaded file is lost (no reference stored).
  - Recommendation: Queue file upload as background job, retry 3x.
- PubSub publish (line 171+) can fail (Redis down).
  - No retry — other participants don't get real-time notification.
  - Message is saved in DB, so not lost, but real-time experience breaks.

**Content-Based Router**:

- Message type routing (TEXT vs. IMAGE vs. AUDIO) is handled by conditional logic (line 115-122).
- This is fine for simple cases, but could be a strategy pattern if message processing grows complex (e.g., moderation, encryption).

## 7. Cross-Cutting Concerns

**Validation**:

- MIME type validation (line 111) — good, but implementation not seen.
- Message content validation (line 115-122) — checks presence, but not format (e.g., max length, no XSS).

**Transactions**:

- `sendMessage` does NOT use explicit transaction:
  1. Upload file.
  2. Create message.
  3. Publish to PubSub.

  If step 2 fails, file is orphaned in Firebase Storage.
  If step 3 fails, message is saved but not broadcast.

**Error handling**:

- Throws `BadRequestException` for business errors (line 78, line 105, line 115).
- No domain exceptions (`InvalidMessageType`, `ParticipantNotInRoom`).

## 8. GraphQL-Specific Notes

**GraphQL subscriptions**:

- `messageSent` subscription (likely in resolver) uses PubSub.
- Subscription filter: `messageSent:${userId}` — each user has a dedicated channel.
- This scales poorly (millions of channels for millions of users) — consider using a single channel with client-side filtering.

**N+1 risk**:

- `getUserChats` (line 20) uses Prisma includes to fetch messages, participants, lastMessage — single query per room, no N+1.
- If client code queries `chats { messages { sender } }`, potential N+1 for sender profile — no DataLoader.

**Authorization**:

- `getOrCreateChat` (line 59) checks if user is participant (line 84-86) — good.
- `sendMessage` checks if sender is participant (line 103-105) — good.
- No authorization for reading messages (assumes resolver handles it).

## 9. Target Structure

```
src/chat/
  domain/
    entities/
      ChatRoom.ts                   # Aggregate root with sendMessage(), addParticipant()
      Message.ts                    # Child entity
    value-objects/
      MessageContent.ts             # Validates content by type (text, image URL, etc.)
      MessageType.ts                # Enum: TEXT, IMAGE, AUDIO, VIDEO, FILE
    repositories/
      IChatRoomRepository.ts        # Interface: findById, findByParticipant, save
      IMessageRepository.ts
    events/
      MessageSent.ts
      MessageRead.ts
      ChatRoomCreated.ts

  application/
    commands/
      SendMessage/
        SendMessageCommand.ts
        SendMessageHandler.ts       # Use case: validate, upload file, create message, emit event
      MarkMessageAsRead/
        MarkMessageAsReadCommand.ts
        MarkMessageAsReadHandler.ts
    queries/
      GetUserChats/
        GetUserChatsQuery.ts
        GetUserChatsHandler.ts
      GetChatRoom/
        GetChatRoomQuery.ts
        GetChatRoomHandler.ts
    event-handlers/
      OnMessageSentBroadcast.ts     # Listens to MessageSent → publishes to PubSub

  infrastructure/
    repositories/
      PrismaChatRoomRepository.ts
      PrismaMessageRepository.ts
    adapters/
      FirebaseFileUploader.ts       # Wraps FirebaseStorageService
      PubSubBroadcaster.ts          # Wraps PubSubService

  presentation/
    resolvers/
      ChatResolver.ts
    types/
      ChatRoomType.ts
      MessageType.ts
```

---

## Persistence Model (Derived from Domain)

```prisma
model ChatRoom {
  id String @id @map("_id")
  errandId String?
  lastMessageId String?
  createdAt DateTime
  updatedAt DateTime

  @@index([errandId]) // serves: findByErrandAndParticipants
  @@index([lastMessageId]) // serves: last-message cleanup checks
}

model ChatParticipant {
  id String @id @map("_id")
  chatRoomId String
  userId String
  joinedAt DateTime

  @@index([userId, chatRoomId]) // serves: findByUser
  @@unique([chatRoomId, userId]) // backs: ParticipantAlreadyExistsError
}

model Message {
  id String @id @map("_id")
  chatRoomId String
  senderId String
  type MessageType
  content String
  createdAt DateTime

  @@index([chatRoomId, createdAt]) // serves: findMessages
}
```

`ChatRoom` is the aggregate root; `ChatParticipant` and append-only `Message` records are reachable only through `IChatRoomRepository`. References are scalar IDs only: `errandId`, `lastMessageId`, `chatRoomId`, `userId`, `senderId`. Cleanup owners: `ErrandDeletedPolicyHandler` archives or detaches errand chats through Chat commands; `UserDeletedPolicyHandler` anonymizes participant/sender display data without removing message history; `DeleteMessageCommandHandler` updates `lastMessageId` before removing a message if deletion is ever allowed. `id` serves `findById`; indexes map directly to chat repository methods and cleanup checks.

---

## 11. Migration Risk & Priority

**Risk**: **MEDIUM**

- Chat is a real-time feature — refactoring could break WebSocket subscriptions if not careful.
- However, chat is isolated from core business flows (errands, payments) — lower criticality.

**Priority**: **PHASE 3 (after Errands/Escrow/Application/Provider/Client)**
**Rationale**:

1. Chat is a supporting feature, not core to job marketplace (errands/payments are core).
2. Refactoring chat doesn't unblock other modules.
3. Current implementation is functional (no critical bugs) — can defer refactoring.

**Migration steps**:

1. **Extract ChatRoom aggregate** with `sendMessage()`, `addParticipant()` methods.
2. **Extract Message value object** with type-specific validation.
3. **Introduce IChatRoomRepository** and `PrismaChatRoomRepository`.
4. **Create SendMessageCommandHandler** (move file upload + validation + broadcast out of service).
5. **Emit domain events**: `MessageSent`, `MessageRead`.
6. **Create event listener** for PubSub broadcasting (decouple from command handler).
7. **Queue file uploads** in BullMQ (retry on failure).
8. **Add DataLoader** for message sender profile (prevent N+1).
9. **Add message moderation** (scan for spam/abuse before broadcasting).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * ChatRoom aggregate root representing conversation between users.
 * Core invariants:
 * - ChatRoom must have at least 2 participants
 * - errandId is optional (chat can exist without errand for direct messaging)
 * - lastMessageId must reference valid message in room
 * - Participants can only read messages if they're in the room
 * - Messages are append-only (cannot edit/delete after send)
 */
class ChatRoomId extends EntityId {
  /**
   * Private constructor. Use ChatRoomId.new() or ChatRoomId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new ChatRoomId.
   */
  static new(): ChatRoomId;

  /**
   * Rehydrates ChatRoomId from persisted value.
   */
  static from(value: string): ChatRoomId;
}

/**
 * Message identifier for chat message entities.
 */
class MessageId extends EntityId {
  /**
   * Private constructor. Use MessageId.new() or MessageId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new MessageId.
   */
  static new(): MessageId;

  /**
   * Rehydrates MessageId from persisted value.
   */
  static from(value: string): MessageId;
}

/**
 * ChatRoom aggregate root representing conversation between users.
 */
class ChatRoom extends AggregateRoot<ChatRoomId> {
  /**
   * Private constructor - use ChatRoom.create() factory or load from repository.
   * @param id Unique chat room identifier (from schema: id String @id)
   * @param errandId Optional errand this chat is for (from schema: errandId String?)
   * @param participantIds Array of user IDs in room (from schema: ChatRoomParticipant[])
   * @param messages Message entities (from schema: Message[])
   * @param lastMessageId Last message ID (from schema: lastMessageId String?)
   * @param createdAt Creation timestamp
   * @param updatedAt Last activity timestamp
   */
  private constructor(
    public readonly id: ChatRoomId,
    public readonly errandId: ErrandId | null,
    private readonly participantIds: UserId[],
    private readonly messages: Message[],
    private lastMessageId: MessageId | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Factory method to create new chat room.
   * Requires at least 2 participants.
   * @param participantIds User IDs (minimum 2)
   * @param errandId Optional errand ID this chat is for
   * @throws InsufficientParticipantsError when < 2 participants
   * @returns New ChatRoom instance
   */
  static create(
    participantIds: UserId[],
    errandId?: ErrandId,
  ): ChatRoom;

  /**
   * Reconstitutes ChatRoom aggregate from persistence.
   */
  static reconstitute(
    id: ChatRoomId,
    errandId: ErrandId | null,
    participantIds: UserId[],
    messages: Message[],
    lastMessageId: MessageId | null,
    createdAt: Date,
    updatedAt: Date,
  ): ChatRoom;

  /**
   * Sends message in chat room.
   * Message is validated based on type (text/image/audio/location).
   * @param senderId User sending message (must be participant)
   * @param messageType Message type enum
   * @param content Message content (text, URL, coordinates, etc.)
   * @throws UnauthorizedSenderError when sender not in participant list
   * @throws InvalidMessageContentError when content doesn't match type
   * @emits MessageSentEvent (triggers PubSub broadcast)
   * @returns New Message ID
   */
  sendMessage(
    senderId: UserId,
    messageType: MessageType,
    content: string,
  ): MessageId;

  /**
   * Marks message as read by user.
   * Updates MessageRead record.
   * @param messageId Message ID
   * @param userId User marking as read (must be participant)
   * @throws UnauthorizedReaderError when user not in participant list
   * @throws MessageNotFoundException when message not in this room
   * @emits MessageReadEvent
   */
  markMessageAsRead(messageId: MessageId, userId: UserId): void;

  /**
   * Adds participant to chat room.
   * Used when new applicant joins errand chat.
   * @param userId User to add
   * @throws ParticipantAlreadyExistsError when user already in room
   * @emits ParticipantAddedEvent
   */
  addParticipant(userId: UserId): void;

  /**
   * Removes participant from chat room.
   * Used when user leaves chat.
   * @param userId User to remove
   * @throws CannotRemoveLastParticipantError when trying to remove last participant
   * @emits ParticipantRemovedEvent
   */
  removeParticipant(userId: UserId): void;

  /**
   * Checks if user is participant.
   * @param userId User ID
   */
  isParticipant(userId: UserId): boolean;

  /**
   * Returns unread message count for user.
   * @param userId User ID
   * @returns Number of unread messages
   */
  getUnreadCount(userId: UserId): number;
}

/**
 * Message entity (child of ChatRoom aggregate).
 * Immutable once created.
 */
class Message {
  constructor(
    public readonly id: MessageId,
    public readonly chatRoomId: ChatRoomId,
    public readonly senderId: UserId,
    public readonly type: MessageType,
    public readonly content: string,
    public readonly createdAt: Date,
  );

  /**
   * Validates message content based on type.
   * TEXT: Any non-empty string
   * IMAGE/AUDIO: Valid URL
   * LOCATION: JSON with lat/lng coordinates
   * @throws InvalidMessageContentError when content invalid for type
   */
  validate(): void;
}

/**
 * ChatRoomParticipant entity (child of ChatRoom).
 */
class ChatRoomParticipant {
  constructor(
    public readonly chatRoomId: ChatRoomId,
    public readonly userId: UserId,
    public readonly joinedAt: Date,
  );
}

/** Thrown when chat room created with < 2 participants. */
class InsufficientParticipantsError extends Error {}

/** Thrown when non-participant tries to send message. */
class UnauthorizedSenderError extends Error {}

/** Thrown when message content doesn't match type. */
class InvalidMessageContentError extends Error {}

/** Thrown when non-participant tries to read message. */
class UnauthorizedReaderError extends Error {}

/** Thrown when message not in chat room. */
class MessageNotFoundException extends Error {}

/** Thrown when participant already in room. */
class ParticipantAlreadyExistsError extends Error {}

/** Thrown when trying to remove last participant. */
class CannotRemoveLastParticipantError extends Error {}
```

### Repository Interface

```typescript
/**
 * Persistence contract for ChatRoom aggregate.
 */
interface IChatRoomRepository {
  /**
   * Finds chat room by unique ID.
   * @param id Chat room ID
   * @returns ChatRoom aggregate or null if not found
   */
  findById(id: ChatRoomId): Promise<ChatRoom | null>;

  /**
   * Finds chat room for specific errand and participants.
   * Each errand + participant pair has one chat room.
   * @param errandId Errand ID
   * @param participantIds Participant user IDs
   * @returns ChatRoom aggregate or null if not found
   */
  findByErrandAndParticipants(
    errandId: ErrandId,
    participantIds: UserId[],
  ): Promise<ChatRoom | null>;

  /**
   * Finds all chat rooms for user.
   * @param userId User ID
   * @returns Array of ChatRoom aggregates sorted by last activity
   */
  findByUser(userId: UserId): Promise<ChatRoom[]>;

  /**
   * Persists chat room aggregate.
   * Messages are append-only - new messages are added, never updated.
   * @param chatRoom ChatRoom to save
   */
  save(chatRoom: ChatRoom): Promise<void>;

  /**
   * Finds messages in chat room with pagination.
   * @param chatRoomId Chat room ID
   * @param limit Max messages to return
   * @param beforeMessageId Optional cursor for pagination (messages before this ID)
   * @returns Array of Message entities sorted by createdAt DESC
   */
  findMessages(
    chatRoomId: ChatRoomId,
    limit: number,
    beforeMessageId?: MessageId,
  ): Promise<Message[]>;
}
```

### Application Layer

```typescript
/**
 * Creates new chat room.
 */
class CreateChatRoomCommandHandler {
  /**
   * @param command Chat room details
   * @throws InsufficientParticipantsError when < 2 participants
   * @throws ErrandNotFoundException when errand doesn't exist (if errandId provided)
   * @emits ChatRoomCreatedEvent
   * @returns Chat room ID
   */
  execute(command: CreateChatRoomCommand): Promise<ChatRoomId>;
}

interface CreateChatRoomCommand {
  participantIds: UserId[];
  errandId?: ErrandId;
}

/**
 * Sends message in chat room.
 * Handles file upload for IMAGE/AUDIO types.
 */
class SendMessageCommandHandler {
  /**
   * @param command Message details
   * @throws ChatRoomNotFoundException when room doesn't exist
   * @throws UnauthorizedSenderError when sender not participant
   * @throws InvalidMessageContentError when content invalid for type
   * @emits MessageSentEvent (triggers PubSub broadcast)
   * @returns Message ID
   */
  execute(command: SendMessageCommand): Promise<MessageId>;
}

interface SendMessageCommand {
  chatRoomId: ChatRoomId;
  senderId: UserId;
  type: MessageType;
  content: string; // text, URL, or JSON coordinates
  file?: Buffer; // for IMAGE/AUDIO uploads (converted to URL by handler)
}

/**
 * Marks message as read.
 */
class MarkMessageAsReadCommandHandler {
  /**
   * @param command Read details
   * @throws ChatRoomNotFoundException when room doesn't exist
   * @throws UnauthorizedReaderError when user not participant
   * @throws MessageNotFoundException when message not in room
   * @emits MessageReadEvent
   */
  execute(command: MarkMessageAsReadCommand): Promise<void>;
}

interface MarkMessageAsReadCommand {
  chatRoomId: ChatRoomId;
  messageId: MessageId;
  userId: UserId;
}

/**
 * Adds participant to chat room.
 */
class AddParticipantCommandHandler {
  /**
   * @param command Participant details
   * @throws ChatRoomNotFoundException when room doesn't exist
   * @throws ParticipantAlreadyExistsError when user already in room
   * @emits ParticipantAddedEvent
   */
  execute(command: AddParticipantCommand): Promise<void>;
}

interface AddParticipantCommand {
  chatRoomId: ChatRoomId;
  userId: UserId;
}

/**
 * Removes participant from chat room.
 */
class RemoveParticipantCommandHandler {
  /**
   * @param command Participant to remove
   * @throws ChatRoomNotFoundException when room doesn't exist
   * @throws CannotRemoveLastParticipantError when removing last participant
   * @emits ParticipantRemovedEvent
   */
  execute(command: RemoveParticipantCommand): Promise<void>;
}

interface RemoveParticipantCommand {
  chatRoomId: ChatRoomId;
  userId: UserId;
}

/**
 * Query handler: Get chat room by ID.
 */
class GetChatRoomQueryHandler {
  /**
   * @param query Chat room ID
   * @returns Chat room details with participants
   * @throws ChatRoomNotFoundException when not found
   */
  execute(query: GetChatRoomQuery): Promise<ChatRoomDTO>;
}

interface GetChatRoomQuery {
  chatRoomId: ChatRoomId;
}

/**
 * Query handler: List user's chat rooms.
 */
class ListUserChatRoomsQueryHandler {
  /**
   * @param query User ID
   * @returns Array of chat rooms sorted by last activity
   */
  execute(query: ListUserChatRoomsQuery): Promise<ChatRoomDTO[]>;
}

interface ListUserChatRoomsQuery {
  userId: UserId;
}

/**
 * Query handler: Get messages in chat room.
 */
class GetMessagesQueryHandler {
  /**
   * @param query Chat room ID with pagination
   * @returns Array of messages with sender details
   */
  execute(query: GetMessagesQuery): Promise<MessageDTO[]>;
}

interface GetMessagesQuery {
  chatRoomId: ChatRoomId;
  limit: number;
  beforeMessageId?: MessageId; // cursor for pagination
}

interface ChatRoomDTO {
  id: ChatRoomId;
  errandId: ErrandId | null;
  participants: { userId: UserId; name: string; image: string | null }[];
  lastMessage: MessageDTO | null;
  unreadCount: number; // for current user
  createdAt: Date;
  updatedAt: Date;
}

interface MessageDTO {
  id: MessageId;
  chatRoomId: ChatRoomId;
  senderId: UserId;
  type: MessageType;
  content: string;
  createdAt: Date;
  sender?: { id: string; name: string; image: string | null };
}
```

### Domain Events

```typescript
/**
 * Emitted when new chat room created.
 * Consumed by: Notification (notify participants)
 */
class ChatRoomCreatedEvent {
  constructor(
    public readonly chatRoomId: ChatRoomId,
    public readonly participantIds: UserId[],
    public readonly errandId: ErrandId | null,
  ) {}
}

/**
 * Emitted when message sent.
 * CRITICAL: Triggers PubSub broadcast to all room participants.
 * Consumed by: PubSub broadcaster, Notification module
 */
class MessageSentEvent {
  constructor(
    public readonly messageId: MessageId,
    public readonly chatRoomId: ChatRoomId,
    public readonly senderId: UserId,
    public readonly type: MessageType,
    public readonly content: string,
    public readonly recipientIds: UserId[], // all participants except sender
  ) {}
}

/**
 * Emitted when message marked as read.
 * Consumed by: Notification (update unread count badge), PubSub (notify sender)
 */
class MessageReadEvent {
  constructor(
    public readonly messageId: MessageId,
    public readonly chatRoomId: ChatRoomId,
    public readonly userId: UserId,
  ) {}
}

/**
 * Emitted when participant added to chat room.
 * Consumed by: Notification (notify new participant)
 */
class ParticipantAddedEvent {
  constructor(
    public readonly chatRoomId: ChatRoomId,
    public readonly userId: UserId,
  ) {}
}

/**
 * Emitted when participant removed from chat room.
 * Consumed by: Notification
 */
class ParticipantRemovedEvent {
  constructor(
    public readonly chatRoomId: ChatRoomId,
    public readonly userId: UserId,
  ) {}
}
```

### Event Handlers (React to other module events)

```typescript
/**
 * Listens to MessageSentEvent and broadcasts to room participants via PubSub.
 * Decouples message sending from broadcasting.
 */
class OnMessageSentBroadcastHandler {
  /**
   * @listens MessageSentEvent
   * Publishes message to PubSub topic for real-time delivery
   */
  handle(event: MessageSentEvent): Promise<void>;
}

/**
 * Listens to ApplicationSubmittedEvent and creates chat room for errand.
 * Workers can chat with client after applying.
 */
class OnApplicationSubmittedCreateChatRoomHandler {
  /**
   * @listens ApplicationSubmittedEvent
   * Creates chat room with client and worker as participants
   */
  handle(event: ApplicationSubmittedEvent): Promise<void>;
}
```
