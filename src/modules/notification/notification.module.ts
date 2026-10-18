import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '@src/firebase/firebase.module';
import {
  GetMarketTemplateHandler,
  ListMarketTemplatesHandler,
  ListNotificationsByUserHandler,
  OnApplicationEventsHandler,
  OnDisputeEventsHandler,
  OnErrandEventsHandler,
  OnNotificationRequestedHandler,
  OnPaymentEventsHandler,
  SendAdminBroadcastHandler,
  SendNotificationHandler,
  UpdateMarketTemplateHandler,
  UpdateNotificationPreferenceHandler,
} from './application';
import {
  INotificationLogRepository,
  INotificationPreferenceRepository,
  INotificationTemplateRepository,
} from './domain';
import {
  EmailAdapter,
  NotificationLogMapper,
  NotificationLogRepository,
  NotificationPreferenceMapper,
  NotificationPreferenceRepository,
  PrismaNotificationTemplateRepository,
  PushNotificationAdapter,
  SmsAdapter,
} from './infrastructure';
import { NotificationTemplateResolver } from './presentation';

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
    OnApplicationEventsHandler,
    OnPaymentEventsHandler,
    OnDisputeEventsHandler,
    OnErrandEventsHandler,
    OnNotificationRequestedHandler,
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
