import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
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
  imports: [CqrsModule, ConfigModule, FirebaseModule],
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
  exports: [INotificationLogRepository, INotificationPreferenceRepository, EmailAdapter, SmsAdapter],
})
export class NotificationModule {}
