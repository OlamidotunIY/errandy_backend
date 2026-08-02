import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  ChatMessage,
  ChatMessagePage,
  IChatMessageRepository,
} from '@module/chat/domain';
import { ChatMessageMapper } from '../mappers';

@Injectable()
export class PrismaChatMessageRepository implements IChatMessageRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ChatMessageMapper,
  ) {}

  async save(message: ChatMessage): Promise<void> {
    const data = this.mapper.toPersistence(message);

    await this.prisma.chatMessage.upsert({
      where: { id: message.id.value },
      create: data,
      update: data,
    });
  }

  async findByThreadId(
    threadId: string,
    pagination: { limit: number; cursor?: string },
  ): Promise<ChatMessagePage> {
    const { limit, cursor } = pagination;

    const records = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { sentAt: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = records.length > limit;
    const items = (hasMore ? records.slice(0, limit) : records).map((r) =>
      this.mapper.toDomain(r),
    );

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id.value : undefined,
    };
  }

  async countByThreadIdAndSender(
    threadId: string,
    senderId: string,
  ): Promise<number> {
    return this.prisma.chatMessage.count({
      where: { threadId, senderId },
    });
  }
}
