import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  INotificationPreferenceRepository,
  NotificationPreference,
} from '../../domain';
import { NotificationPreferenceMapper } from '../mappers';

@Injectable()
export class NotificationPreferenceRepository implements INotificationPreferenceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: NotificationPreferenceMapper,
  ) {}

  async save(preference: NotificationPreference): Promise<void> {
    const data = this.mapper.toPersistence(preference);

    await this.prisma.notificationPreference.upsert({
      where: { id: preference.id.value },
      create: data,
      update: data,
    });
  }

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const record = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return record ? this.mapper.toDomain(record) : null;
  }
}
