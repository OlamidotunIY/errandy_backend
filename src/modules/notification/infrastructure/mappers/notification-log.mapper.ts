import { Injectable } from '@nestjs/common';
import { NotificationLog as PrismaNotificationLog } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/edge';
import { NotificationLog, NotificationLogId } from '../../domain';

@Injectable()
export class NotificationLogMapper {
  toDomain(record: PrismaNotificationLog): NotificationLog {
    return NotificationLog.reconstitute({
      id: NotificationLogId.fromString(record.id),
      userId: record.userId,
      type: record.type,
      channel: record.channel,
      payload: record.payload as Record<string, unknown>,
      status: record.status as 'SENT' | 'FAILED',
      failureReason: record.failureReason,
      createdAt: record.createdAt,
    });
  }

  toPersistence(log: NotificationLog): {
    id: string;
    userId: string;
    type: string;
    channel: string;
    payload: InputJsonValue;
    status: string;
    failureReason: string | null;
    createdAt: Date;
  } {
    return {
      id: log.id.value,
      userId: log.userId,
      type: log.type,
      channel: log.channel,
      payload: log.payload as InputJsonValue,
      status: log.status,
      failureReason: log.failureReason,
      createdAt: log.createdAt,
    };
  }
}
