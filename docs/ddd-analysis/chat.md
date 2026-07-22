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

## 10. Schema Findings

**Context**: Analysis of `prisma/model/chat.prisma`.

### Aggregate Boundary Violations

**None found for ChatRoom/Message aggregates** — no other modules directly mutate chat entities. Chat aggregate integrity is intact at schema level.

### Dangling Reference Risks

1. **ChatRoom.lastMessageId → Message** (CRITICAL BUG — already documented)
   - **Schema**: `ChatRoom.lastMessage` relation has `onDelete: NoAction, onUpdate: NoAction`.
   - **Bug**: Deleting message that is `lastMessage` leaves dangling `lastMessageId`.
   - **Evidence**: No handler in `src/chat/chat.service.ts` to update `ChatRoom.lastMessageId` when message deleted.
   - **Impact**: **URGENT** — GraphQL queries resolving `ChatRoom.lastMessage` will fail.
   - **Current cleanup**: None.
   - **Fix** (already documented in Critical Issues):

     ```typescript
     async deleteMessage(messageId: string) {
       const message = await this.prisma.message.findUnique({ where: { id: messageId } });
       const room = await this.prisma.chatRoom.findUnique({ where: { id: message.roomId } });

       if (room.lastMessageId === messageId) {
         const previousMessage = await this.prisma.message.findFirst({
           where: { roomId: message.roomId, id: { not: messageId } },
           orderBy: { createdAt: 'desc' },
         });
         await this.prisma.chatRoom.update({
           where: { id: message.roomId },
           data: { lastMessageId: previousMessage?.id || null },
         });
       }

       await this.prisma.message.delete({ where: { id: messageId } });
     }
     ```

   - **Backfill script** (clean production data):
     ```typescript
     // scripts/fix-dangling-last-messages.ts
     async function fixDanglingLastMessages() {
       const rooms = await prisma.chatRoom.findMany({
         where: { lastMessageId: { not: null } },
       });
       for (const room of rooms) {
         const messageExists = await prisma.message.findUnique({
           where: { id: room.lastMessageId },
         });
         if (!messageExists) {
           const latestMessage = await prisma.message.findFirst({
             where: { roomId: room.id },
             orderBy: { createdAt: 'desc' },
           });
           await prisma.chatRoom.update({
             where: { id: room.id },
             data: { lastMessageId: latestMessage?.id || null },
           });
           console.log(`Fixed dangling lastMessageId for room ${room.id}`);
         }
       }
     }
     ```
   - **Migration**: Code deployment (fix service) + backfill script.
   - **Rollback**: Code revert (but backfill is one-way cleanup).
   - **Priority**: **PHASE 1 (URGENT)**.

2. **Message.roomId → ChatRoom**
   - **Schema**: `Message.room` relation has `onDelete: Cascade` ✅.
   - **Correct**: Deleting chat room cascades to all messages in that room.
   - **No action needed**.

3. **Message.senderId → User**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting user orphans all messages from that user.
   - **Impact**: MEDIUM — cannot resolve sender in GraphQL queries.
   - **Fix options**:
     - **Option A**: Add `onDelete: SetNull` (preserve message content, mark sender as deleted).
     - **Option B**: Soft-delete user instead.
   - **Recommendation**: Option A (preserve chat history).
   - **Schema change**:
     ```prisma
     model Message {
       sender User? @relation(fields: [senderId], references: [id], onDelete: SetNull)
     }
     ```
   - **Note**: Requires making `senderId` nullable.
   - **Priority**: PHASE 2.

4. **ChatParticipant.userId → User**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting user orphans participant records.
   - **Impact**: MEDIUM — chat room shows ghost participant.
   - **Fix**: Add `onDelete: Cascade` (remove participant on user deletion).
   - **Priority**: PHASE 2.

5. **ChatParticipant.roomId → ChatRoom**
   - **Schema**: No cascade rule specified (likely defaults to client-side handling).
   - **Expected**: Deleting chat room should cascade to participants.
   - **Recommendation**: Add `onDelete: Cascade` for clarity.
   - **Priority**: PHASE 2.

### Missing Indexes

**All critical indexes confirmed present**:

- ✅ `ChatRoom` has `@@unique([participantA, participantB])` (also functions as compound index).
- ✅ `Message.roomId` has `@@index([roomId])`.
- ✅ `ChatParticipant.userId` has `@@index([userId])`.

**Potential optimization** (LOW priority):

- `Message.createdAt` — add `@@index([createdAt])` for sorting messages by date.
- **Impact**: Sorting large message lists (`orderBy: { createdAt: 'desc' }`) could be slow.
- **Priority**: PHASE 3 (optimization, defer until performance issue observed).

### Embed vs. Reference Decisions

**ChatParticipant as separate collection** (current approach is correct):

- **Decision**: Keep ChatParticipant as separate collection with references to User and ChatRoom.
- **Justification**:
  - Chat room can have multiple participants (1:N relation).
  - Participants are queried independently (get all chats for user).
  - Embedding would duplicate data.
- **No schema change needed**.

### Migration / Rollback Strategy

**Phase 1 changes for Chat** (URGENT):

1. **Fix deleteMessage dangling-reference bug** (code + backfill):
   - Update `ChatService.deleteMessage` to update `ChatRoom.lastMessageId`.
   - Run `scripts/fix-dangling-last-messages.ts` on production.
   - Migration: Code deployment + manual backfill script run.
   - Rollback: Code revert (but backfill is one-way cleanup).
   - Risk: LOW (simple code change, idempotent backfill).

**Phase 2 changes for Chat**:

1. **Add cascade rules** (3 dangling-reference fixes):
   - `Message.senderId` → `onDelete: SetNull` (requires making senderId nullable).
   - `ChatParticipant.userId` → `onDelete: Cascade`.
   - `ChatParticipant.roomId` → `onDelete: Cascade`.
   - Migration: `npx prisma db push`.
   - Rollback: Safe (remove cascade rules).
   - Risk: LOW.

2. **Extract ChatRoom aggregate** (code-only):
   - Create `ChatRoom.sendMessage()`, `ChatRoom.addParticipant()` methods.
   - Emit events: `MessageSent`, `ParticipantAdded`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: MEDIUM (real-time subscriptions must continue working during migration).

**Risk revised from MEDIUM to LOW-MEDIUM**: Schema changes are low-risk (1 urgent bug fix, 3 optional cascade rules). Main risk is aggregate extraction (real-time features).

**Mitigation**: Fix lastMessageId bug immediately (Phase 1), defer aggregate extraction to Phase 2 after event infrastructure stable.

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
class ChatRoom {
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
    public readonly id: string,
    public readonly errandId: string | null,
    private readonly participantIds: string[],
    private readonly messages: Message[],
    private lastMessageId: string | null,
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
    participantIds: string[],
    errandId?: string,
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
    senderId: string,
    messageType: MessageType,
    content: string,
  ): string;

  /**
   * Marks message as read by user.
   * Updates MessageRead record.
   * @param messageId Message ID
   * @param userId User marking as read (must be participant)
   * @throws UnauthorizedReaderError when user not in participant list
   * @throws MessageNotFoundException when message not in this room
   * @emits MessageReadEvent
   */
  markMessageAsRead(messageId: string, userId: string): void;

  /**
   * Adds participant to chat room.
   * Used when new applicant joins errand chat.
   * @param userId User to add
   * @throws ParticipantAlreadyExistsError when user already in room
   * @emits ParticipantAddedEvent
   */
  addParticipant(userId: string): void;

  /**
   * Removes participant from chat room.
   * Used when user leaves chat.
   * @param userId User to remove
   * @throws CannotRemoveLastParticipantError when trying to remove last participant
   * @emits ParticipantRemovedEvent
   */
  removeParticipant(userId: string): void;

  /**
   * Checks if user is participant.
   * @param userId User ID
   */
  isParticipant(userId: string): boolean;

  /**
   * Returns unread message count for user.
   * @param userId User ID
   * @returns Number of unread messages
   */
  getUnreadCount(userId: string): number;
}

/**
 * Message entity (child of ChatRoom aggregate).
 * Immutable once created.
 */
class Message {
  constructor(
    public readonly id: string,
    public readonly chatRoomId: string,
    public readonly senderId: string,
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
    public readonly chatRoomId: string,
    public readonly userId: string,
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
  findById(id: string): Promise<ChatRoom | null>;

  /**
   * Finds chat room for specific errand and participants.
   * Each errand + participant pair has one chat room.
   * @param errandId Errand ID
   * @param participantIds Participant user IDs
   * @returns ChatRoom aggregate or null if not found
   */
  findByErrandAndParticipants(
    errandId: string,
    participantIds: string[],
  ): Promise<ChatRoom | null>;

  /**
   * Finds all chat rooms for user.
   * @param userId User ID
   * @returns Array of ChatRoom aggregates sorted by last activity
   */
  findByUser(userId: string): Promise<ChatRoom[]>;

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
    chatRoomId: string,
    limit: number,
    beforeMessageId?: string,
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
  execute(command: CreateChatRoomCommand): Promise<string>;
}

interface CreateChatRoomCommand {
  participantIds: string[];
  errandId?: string;
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
  execute(command: SendMessageCommand): Promise<string>;
}

interface SendMessageCommand {
  chatRoomId: string;
  senderId: string;
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
  chatRoomId: string;
  messageId: string;
  userId: string;
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
  chatRoomId: string;
  userId: string;
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
  chatRoomId: string;
  userId: string;
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
  chatRoomId: string;
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
  userId: string;
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
  chatRoomId: string;
  limit: number;
  beforeMessageId?: string; // cursor for pagination
}

interface ChatRoomDTO {
  id: string;
  errandId: string | null;
  participants: { userId: string; name: string; image: string | null }[];
  lastMessage: MessageDTO | null;
  unreadCount: number; // for current user
  createdAt: Date;
  updatedAt: Date;
}

interface MessageDTO {
  id: string;
  chatRoomId: string;
  senderId: string;
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
    public readonly chatRoomId: string,
    public readonly participantIds: string[],
    public readonly errandId: string | null,
  ) {}
}

/**
 * Emitted when message sent.
 * CRITICAL: Triggers PubSub broadcast to all room participants.
 * Consumed by: PubSub broadcaster, Notification module
 */
class MessageSentEvent {
  constructor(
    public readonly messageId: string,
    public readonly chatRoomId: string,
    public readonly senderId: string,
    public readonly type: MessageType,
    public readonly content: string,
    public readonly recipientIds: string[], // all participants except sender
  ) {}
}

/**
 * Emitted when message marked as read.
 * Consumed by: Notification (update unread count badge), PubSub (notify sender)
 */
class MessageReadEvent {
  constructor(
    public readonly messageId: string,
    public readonly chatRoomId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Emitted when participant added to chat room.
 * Consumed by: Notification (notify new participant)
 */
class ParticipantAddedEvent {
  constructor(
    public readonly chatRoomId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Emitted when participant removed from chat room.
 * Consumed by: Notification
 */
class ParticipantRemovedEvent {
  constructor(
    public readonly chatRoomId: string,
    public readonly userId: string,
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
