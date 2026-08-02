import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  ChatMessageMapper,
  ChatThreadMapper,
  CloseChatThreadHandler,
  GetChatThreadByErrandIdHandler,
  IChatMessageRepository,
  IChatThreadRepository,
  ListMessagesHandler,
  OpenChatThreadHandler,
  PrismaChatMessageRepository,
  PrismaChatThreadRepository,
  RealtimeMessagingAdapter,
  SendMessageHandler,
} from '@module/chat';
import { ChatResolver } from './presentation';

@Module({
  imports: [CqrsModule],
  providers: [
    ChatResolver,
    ChatThreadMapper,
    ChatMessageMapper,
    RealtimeMessagingAdapter,
    {
      provide: IChatThreadRepository,
      useClass: PrismaChatThreadRepository,
    },
    {
      provide: IChatMessageRepository,
      useClass: PrismaChatMessageRepository,
    },
    OpenChatThreadHandler,
    CloseChatThreadHandler,
    SendMessageHandler,
    GetChatThreadByErrandIdHandler,
    ListMessagesHandler,
  ],
  exports: [IChatThreadRepository, IChatMessageRepository],
})
export class ChatModule {}
