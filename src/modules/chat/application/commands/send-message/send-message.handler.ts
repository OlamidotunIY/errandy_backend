import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { SendMessageCommand, SendMessageResponseDto } from '.';
import {
  ChatMessage,
  ChatThreadClosedError,
  ChatThreadNotFoundError,
  IChatMessageRepository,
  IChatThreadRepository,
} from '@module/chat/domain';
import { RealtimeMessagingAdapter } from '@module/chat/infrastructure';
import { ILogger } from '@src/common';

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  constructor(
    private readonly chatThreadRepository: IChatThreadRepository,
    private readonly chatMessageRepository: IChatMessageRepository,
    private readonly realtimeMessagingAdapter: RealtimeMessagingAdapter,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: SendMessageCommand): Promise<SendMessageResponseDto> {
    const { threadId, senderId, content, isProviderSender } = command.payload;

    const thread = await this.chatThreadRepository.findById(threadId);
    if (!thread) {
      throw new ChatThreadNotFoundError(threadId);
    }
    if (!thread.isOpen()) {
      throw new ChatThreadClosedError(threadId);
    }

    const message = ChatMessage.create(threadId, senderId, content);
    await this.chatMessageRepository.save(message);

    for (const event of message.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    if (isProviderSender && !thread.firstResponseAt) {
      const priorCount =
        await this.chatMessageRepository.countByThreadIdAndSender(
          threadId,
          senderId,
        );

      if (priorCount <= 1) {
        thread.recordFirstResponse(senderId);
        await this.chatThreadRepository.save(thread);

        for (const event of thread.pullDomainEvents()) {
          this.eventBus.publish(event);
        }
      }
    }

    this.realtimeMessagingAdapter.publish({
      threadId,
      messageId: message.id.value,
      senderId,
      content,
      sentAt: message.sentAt.toISOString(),
    });

    this.logger.info('Message sent', { threadId, senderId });

    return {
      messageId: message.id.value,
      sentAt: message.sentAt.toISOString(),
    };
  }
}
