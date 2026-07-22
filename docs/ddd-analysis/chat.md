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

## 10. Migration Risk & Priority

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
