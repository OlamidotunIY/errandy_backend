import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NotificationModule } from '@module/notification/notification.module';
import { BetterAuthIntegration } from './infrastructure/adapters/better-auth.hooks';

@Module({
  imports: [CqrsModule, NotificationModule],
  providers: [BetterAuthIntegration],
  exports: [BetterAuthIntegration],
})
export class UserModule {}
