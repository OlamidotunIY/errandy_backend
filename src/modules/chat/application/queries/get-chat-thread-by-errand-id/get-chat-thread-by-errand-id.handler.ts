import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ChatThreadResponseDto, GetChatThreadByErrandIdQuery } from '.';
import { IChatThreadRepository } from '@module/chat/domain';

@QueryHandler(GetChatThreadByErrandIdQuery)
export class GetChatThreadByErrandIdHandler implements IQueryHandler<GetChatThreadByErrandIdQuery> {
  constructor(private readonly chatThreadRepository: IChatThreadRepository) {}

  async execute(
    query: GetChatThreadByErrandIdQuery,
  ): Promise<ChatThreadResponseDto | null> {
    const thread = await this.chatThreadRepository.findByErrandId(
      query.payload.errandId,
    );

    if (!thread) {
      return null;
    }

    return {
      id: thread.id.value,
      errandId: thread.errandId,
      participantIds: thread.participantIds,
      createdAt: thread.createdAt.toISOString(),
      closedAt: thread.closedAt?.toISOString(),
      firstResponseAt: thread.firstResponseAt?.toISOString(),
    };
  }
}
