import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GqlConfig } from '@src/config/graphql-ws';
import { GraphqlExceptionFilter } from '@src/common/filters/graphql-exception.filter';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationModule } from '@module/notification/notification.module';
import { PartyModule } from '@module/party/party.module';
import { AddressModule } from '@module/address/address.module';
import { EscrowModule } from '@module/escrow/escrow.module';
import { ServiceModule } from '@module/service/service.module';
import { CategoryModule } from '@module/category/category.module';
import { WalletModule } from '@module/wallet/wallet.module';
import { ChatModule } from '@module/chat/chat.module';
import { UserModule } from '@module/user/user.module';
import { PaymentProviderModule } from '@src/infrastructure/payment-provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PaymentProviderModule,
    GqlConfig,
    EventEmitterModule.forRoot(),
    PrismaModule,
    NotificationModule,
    PartyModule,
    AddressModule,
    EscrowModule,
    ServiceModule,
    CategoryModule,
    WalletModule,
    ChatModule,
    UserModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GraphqlExceptionFilter,
    },
  ],
})
export class AppModule {}
