# Module: chat

## Modeling correction worth flagging explicitly

`VerificationStep` and `TrustedCircleMember` are legitimate Prisma composite types because they're small and bounded (a handful of steps, a bounded circle). `ChatMessage` is **not** — a single conversation can accumulate thousands of messages over an errand's lifetime, and embedding them inside `ChatThread` would risk MongoDB's 16MB document size limit and is a documented anti-pattern (the "massive array" anti-pattern in MongoDB's own schema-design guidance). So `ChatMessage` gets its **own collection**, referenced by `threadId`, not composited into `ChatThread`.

This also means `ChatThread` and `ChatMessage` aren't one single aggregate the way `Party`+`ProviderRole` are — `sendMessage()` shouldn't require loading the entire thread with its full message history just to append one more message. `SendMessageCommand`'s handler checks `ChatThread`'s status only (open vs. closed) via a lightweight existence/status query, then inserts a `ChatMessage` directly — it never loads the message history to do this.

## Folder placement

```
src/modules/chat/
├── domain/
│   ├── entities/
│   │   ├── chat-thread.entity.ts
│   │   └── chat-message.entity.ts
│   ├── repositories/
│   │   ├── chat-thread.repository.interface.ts
│   │   └── chat-message.repository.interface.ts
│   ├── events/
│   │   ├── chat-thread-opened.event.ts
│   │   ├── message-sent.event.ts
│   │   ├── chat-thread-closed.event.ts
│   │   └── provider-responded-first-time.event.ts
│   └── errors/
│       ├── chat-thread-not-found.error.ts
│       └── chat-thread-closed.error.ts
├── application/
│   ├── commands/
│   │   ├── open-chat-thread/       (dispatched by ChatLifecycleSaga in errands, not a public route)
│   │   ├── close-chat-thread/      (same)
│   │   └── send-message/
│   └── queries/
│       ├── get-chat-thread-by-errand-id/
│       └── list-messages/                (paginated)
├── infrastructure/
│   ├── adapters/
│   │   └── realtime-messaging.adapter.ts
│   ├── mappers/
│   │   ├── chat-thread.mapper.ts
│   │   └── chat-message.mapper.ts
│   └── repositories/
│       ├── chat-thread.repository.ts
│       └── chat-message.repository.ts
└── chat.module.ts
```

## Prisma schema

```prisma
model ChatThread {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  errandId        String    @db.ObjectId
  participantIds  String[]  @db.ObjectId   // better-auth userIds, not Party ids — actual people in the conversation
  createdAt       DateTime  @default(now())
  closedAt        DateTime?
  firstResponseAt DateTime?

  @@index([errandId])
}

model ChatMessage {
  id       String   @id @default(auto()) @map("_id") @db.ObjectId
  threadId String   @db.ObjectId
  senderId String   @db.ObjectId
  content  String
  sentAt   DateTime @default(now())

  @@index([threadId, sentAt])
}
```

## Domain entity methods

**`ChatThread`**
- `open(errandId, participantIds)`
- `close()`
- `recordFirstResponse()` — sets `firstResponseAt` if not already set; fires `ProviderRespondedFirstTime` (consumed by `party` module's nightly response-time recalc)

**`ChatMessage`**
- `create(threadId, senderId, content)` — no behavior beyond construction; this is a near-anemic entity by design, appropriate for a supporting subdomain

## Events

| Event | Raised by | Payload |
|---|---|---|
| `ChatThreadOpened` | `ChatThread.open()` | `{ threadId, errandId, correlationId }` |
| `MessageSent` | `ChatMessage.create()` | `{ threadId, senderId, correlationId }` |
| `ChatThreadClosed` | `ChatThread.close()` | `{ threadId, correlationId }` |
| `ProviderRespondedFirstTime` | `ChatThread.recordFirstResponse()` | `{ threadId, providerId, responseTimeSeconds, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `OpenChatThreadCommand` | Previously undefined — needed since `ChatLifecycleSaga` (in `errands`) dispatches into this module rather than calling it directly. `{ errandId, participantIds }` → `ChatThread.open()`. |
| `CloseChatThreadCommand` | `{ threadId }` → `ChatThread.close()`, dispatched by the same saga. |
| `SendMessageCommand` | Checks thread status only (not message history) before inserting — see the modeling note at the top of this file. If this is the assigned provider's first message in the thread, also calls `recordFirstResponse()`. |

## Event Handlers, Sagas, Jobs

None owned here — `ChatLifecycleSaga` lives in `errands` per the trigger-module convention, dispatching `OpenChatThreadCommand`/`CloseChatThreadCommand` into this module.

## Repository interfaces

```typescript
abstract class IChatThreadRepository {
  abstract save(thread: ChatThread): Promise<void>;
  abstract findById(id: string): Promise<ChatThread | null>;
  abstract findByErrandId(errandId: string): Promise<ChatThread | null>;
}
abstract class IChatMessageRepository {
  abstract save(message: ChatMessage): Promise<void>;
  abstract findByThreadId(threadId: string, pagination: { limit: number; cursor?: string }): Promise<{ items: ChatMessage[]; nextCursor?: string }>;
}
```

## DTOs

```typescript
// commands/send-message/send-message.request.dto.ts
interface SendMessageRequestDto {
  threadId: string;
  senderId: string;
  content: string;
}
interface SendMessageResponseDto {
  messageId: string;
  sentAt: string;
}

// queries/list-messages/list-messages.request.dto.ts
interface ListMessagesRequestDto {
  threadId: string;
  limit: number;
  cursor?: string;
}
interface MessageResponseDto {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
}
```

## Mappers

`ChatThreadMapper`, `ChatMessageMapper` — thin `toDomain`/`toPersistence`.

## Presentation

```graphql
type Mutation {
  sendMessage(input: SendMessageInput!): SendMessageResult! @auth
}
type Query {
  chatThreadByErrand(errandId: ID!): ChatThread @auth
  messages(threadId: ID!, limit: Int!, cursor: String): [Message!]! @auth
}
type Subscription {
  messageSent(threadId: ID!): Message! @auth   # backed by RealtimeMessagingAdapter, not polling
}
```

`openChatThread`/`closeChatThread` have **no fields at all** — saga-only, never reachable from the API layer.

## Open items

None new.
