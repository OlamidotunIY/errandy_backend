import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { OpenChatThreadCommand, OpenChatThreadResponseDto } from '.';
import { ChatThread, IChatThreadRepository } from '@module/chat/domain';
import { ILogger } from '@src/common';

@CommandHandler(OpenChatThreadCommand)
export class OpenChatThreadHandler implements ICommandHandler<OpenChatThreadCommand> {
  constructor(
    private readonly chatThreadRepository: IChatThreadRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: OpenChatThreadCommand,
  ): Promise<OpenChatThreadResponseDto> {
    const { errandId, participantIds } = command.payload;

    const existing = await this.chatThreadRepository.findByErrandId(errandId);
    if (existing) {
      return { threadId: existing.id.value };
    }

    const thread = ChatThread.open(errandId, participantIds);
    await this.chatThreadRepository.save(thread);

    for (const event of thread.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Chat thread opened', {
      threadId: thread.id.value,
      errandId,
    });

    return { threadId: thread.id.value };
  }
}
