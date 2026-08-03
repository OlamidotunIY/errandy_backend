import { Injectable } from '@nestjs/common';
import { NotificationPreference as PrismaNotificationPreference } from '@prisma/client';
import { NotificationPreference, NotificationPreferenceId } from '../../domain';

@Injectable()
export class NotificationPreferenceMapper {
  toDomain(record: PrismaNotificationPreference): NotificationPreference {
    return NotificationPreference.reconstitute({
      id: NotificationPreferenceId.fromString(record.id),
      userId: record.userId,
      emailEnabled: record.emailEnabled,
      smsEnabled: record.smsEnabled,
      pushEnabled: record.pushEnabled,
      updatedAt: record.updatedAt,
    });
  }

  toPersistence(preference: NotificationPreference): {
    id: string;
    userId: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    updatedAt: Date;
  } {
    return {
      id: preference.id.value,
      userId: preference.userId,
      emailEnabled: preference.emailEnabled,
      smsEnabled: preference.smsEnabled,
      pushEnabled: preference.pushEnabled,
      updatedAt: preference.updatedAt,
    };
  }
}
