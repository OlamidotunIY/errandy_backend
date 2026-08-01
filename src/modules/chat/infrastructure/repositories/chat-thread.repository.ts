import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ChatThread, IChatThreadRepository } from '@module/chat/domain';
import { ChatThreadMapper } from '../mappers';

@Injectable()
export class PrismaChatThreadRepository implements IChatThreadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ChatThreadMapper,
  ) {}

  async save(thread: ChatThread): Promise<void> {
    const data = this.mapper.toPersistence(thread);

    await this.prisma.chatThread.upsert({
      where: { id: thread.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<ChatThread | null> {
    const record = await this.prisma.chatThread.findUnique({
      where: { id },
    });

    return record ? this.mapper.toDomain(record) : null;
  }

  async findByErrandId(errandId: string): Promise<ChatThread | null> {
    const record = await this.prisma.chatThread.findUnique({
      where: { errandId },
    });

    return record ? this.mapper.toDomain(record) : null;
  }
}
