import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '@src/firebase/firebase.module';
import {
  EmailAdapter,
  INotificationLogRepository,
  INotificationPreferenceRepository,
  INotificationTemplateRepository,
  ListNotificationsByUserHandler,
  NotificationLogMapper,
  NotificationLogRepository,
  NotificationPreferenceMapper,
  NotificationPreferenceRepository,
  PrismaNotificationTemplateRepository,
  PushNotificationAdapter,
  SendNotificationHandler,
  SmsAdapter,
  UpdateNotificationPreferenceHandler,
  GetMarketTemplateHandler,
  ListMarketTemplatesHandler,
  UpdateMarketTemplateHandler,
  SendAdminBroadcastHandler,
  NotificationTemplateResolver,
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
    {
      provide: INotificationTemplateRepository,
      useClass: PrismaNotificationTemplateRepository,
    },
    EmailAdapter,
    SmsAdapter,
    PushNotificationAdapter,
    SendNotificationHandler,
    UpdateNotificationPreferenceHandler,
    ListNotificationsByUserHandler,
    GetMarketTemplateHandler,
    ListMarketTemplatesHandler,
    UpdateMarketTemplateHandler,
    SendAdminBroadcastHandler,
    NotificationTemplateResolver,
  ],
  exports: [
    INotificationLogRepository,
    INotificationPreferenceRepository,
    INotificationTemplateRepository,
    EmailAdapter,
    SmsAdapter,
  ],
})
export class NotificationModule {}
