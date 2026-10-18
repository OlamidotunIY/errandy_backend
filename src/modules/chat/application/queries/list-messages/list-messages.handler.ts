import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListMessagesQuery } from './list-messages.query';
import { ListMessagesResponseDto } from './list-messages.request.dto';
import { IChatMessageRepository } from '@module/chat/domain';

@QueryHandler(ListMessagesQuery)
export class ListMessagesHandler implements IQueryHandler<ListMessagesQuery> {
  constructor(private readonly chatMessageRepository: IChatMessageRepository) {}

  async execute(query: ListMessagesQuery): Promise<ListMessagesResponseDto> {
    const { threadId, limit, cursor } = query.payload;

    const page = await this.chatMessageRepository.findByThreadId(threadId, {
      limit,
      cursor,
    });

    return {
      items: page.items.map((message) => ({
        id: message.id.value,
        threadId: message.threadId,
        senderId: message.senderId,
        content: message.content,
        sentAt: message.sentAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }
}
