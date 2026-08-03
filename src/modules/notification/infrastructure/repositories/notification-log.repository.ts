import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { INotificationLogRepository, NotificationLog } from '../../domain';
import { NotificationLogMapper } from '../mappers';

@Injectable()
export class NotificationLogRepository implements INotificationLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: NotificationLogMapper,
  ) {}

  async save(log: NotificationLog): Promise<void> {
    const data = this.mapper.toPersistence(log);

    await this.prisma.notificationLog.upsert({
      where: { id: log.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<NotificationLog | null> {
    const record = await this.prisma.notificationLog.findUnique({
      where: { id },
    });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByUserId(
    userId: string,
    pagination: { limit: number; cursor?: string },
  ): Promise<{ items: NotificationLog[]; nextCursor?: string }> {
    const records = await this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: pagination.limit,
      ...(pagination.cursor
        ? { cursor: { id: pagination.cursor }, skip: 1 }
        : {}),
    });

    const items = records.map((record) => this.mapper.toDomain(record));
    const nextCursor =
      records.length === pagination.limit
        ? records[records.length - 1].id
        : undefined;

    return { items, nextCursor };
  }

  async findFailed(): Promise<NotificationLog[]> {
    const records = await this.prisma.notificationLog.findMany({
      where: { status: 'FAILED' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }
}
