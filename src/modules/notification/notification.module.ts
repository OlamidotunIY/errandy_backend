import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '@src/email/email.module';
import { FirebaseModule } from '@src/firebase/firebase.module';
import {
  EmailAdapter,
  INotificationLogRepository,
  INotificationPreferenceRepository,
  ListNotificationsByUserHandler,
  NotificationLogMapper,
  NotificationLogRepository,
  NotificationPreferenceMapper,
  NotificationPreferenceRepository,
  PushNotificationAdapter,
  SendNotificationHandler,
  SmsAdapter,
  UpdateNotificationPreferenceHandler,
} from '@module/notification';

@Module({
  imports: [CqrsModule, ConfigModule, EmailModule, FirebaseModule],
  providers: [
    NotificationLogMapper,
    NotificationPreferenceMapper,
    {
      provide: INotificationLogRepository,
      useClass: NotificationLogRepository,
    },
    {
      provide: INotificationPreferenceRepository,
      useClass: NotificationPreferenceRepository,
    },
    EmailAdapter,
    SmsAdapter,
    PushNotificationAdapter,
    SendNotificationHandler,
    UpdateNotificationPreferenceHandler,
    ListNotificationsByUserHandler,
  ],
  exports: [INotificationLogRepository, INotificationPreferenceRepository],
})
export class NotificationModule {}
