import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  ListNotificationsByUserQuery,
  ListNotificationsByUserResponseDto,
} from '.';
import { INotificationLogRepository } from '@module/notification/domain';

@QueryHandler(ListNotificationsByUserQuery)
export class ListNotificationsByUserHandler implements IQueryHandler<ListNotificationsByUserQuery> {
  constructor(private readonly logRepository: INotificationLogRepository) {}

  async execute(
    query: ListNotificationsByUserQuery,
  ): Promise<ListNotificationsByUserResponseDto> {
    const { userId, limit, cursor } = query.payload;

    const { items, nextCursor } = await this.logRepository.findByUserId(
      userId,
      { limit, cursor },
    );

    return {
      items: items.map((log) => ({
        id: log.id.value,
        type: log.type,
        channel: log.channel,
        status: log.status,
        failureReason: log.failureReason,
        createdAt: log.createdAt,
      })),
      nextCursor,
    };
  }
}
