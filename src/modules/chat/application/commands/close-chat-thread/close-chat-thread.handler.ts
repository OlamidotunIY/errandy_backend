import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CloseChatThreadCommand, CloseChatThreadResponseDto } from '.';
import {
  ChatThreadNotFoundError,
  IChatThreadRepository,
} from '@module/chat/domain';
import { ILogger } from '@src/common';

@CommandHandler(CloseChatThreadCommand)
export class CloseChatThreadHandler implements ICommandHandler<CloseChatThreadCommand> {
  constructor(
    private readonly chatThreadRepository: IChatThreadRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: CloseChatThreadCommand,
  ): Promise<CloseChatThreadResponseDto> {
    const { threadId } = command.payload;

    const thread = await this.chatThreadRepository.findById(threadId);
    if (!thread) {
      throw new ChatThreadNotFoundError(threadId);
    }

    thread.close();
    await this.chatThreadRepository.save(thread);

    for (const event of thread.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Chat thread closed', { threadId });

    return {
      threadId: thread.id.value,
      closedAt: (thread.closedAt as Date).toISOString(),
    };
  }
}
