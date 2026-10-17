import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  ChatLifecycleSaga,
  CloseChatThreadHandler,
  GetChatThreadByErrandIdHandler,
  ListMessagesHandler,
  OpenChatThreadHandler,
  SendMessageHandler,
} from './application';
import { IChatMessageRepository, IChatThreadRepository } from './domain';
import {
  ChatMessageMapper,
  ChatThreadMapper,
  PrismaChatMessageRepository,
  PrismaChatThreadRepository,
  RealtimeMessagingAdapter,
} from './infrastructure';
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
    ChatLifecycleSaga,
  ],
  exports: [IChatThreadRepository, IChatMessageRepository],
})
export class ChatModule {}
