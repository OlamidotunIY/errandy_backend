import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressModule } from './address/address.module';
import { ServiceModule } from './service/service.module';
import { ApplicationModule } from './application/application.module';
import { ChatModule } from './chat/chat.module';
import { WalletModule } from './wallet/wallet.module';
import { ErrandsModule } from './errands/errands.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { ConfigModule } from '@nestjs/config';
import { ClientModule } from './client/client.module';
import { RatingResolver } from './rating/rating.resolver';
import { RatingModule } from './rating/rating.module';
import { PaymentGatewayModule } from './payment-gateway/payment-gateway.module';
import { OrganizationModule } from './organization/organization.module';
import { NotificationModule } from './notification/notification.module';
import { VerificationModule } from './verification/verification.module';
import { TrustedCircleModule } from './trusted-circle/trusted-circle.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailModule } from './email/email.module';
import { PushModule } from './push/push.module';
import { ProviderModule } from './provider/provider.module';
import { FirebaseModule } from './firebase/firebase.module';
import { PresenceModule } from './presence/presence.module';
import { GqlConfig } from './config/graphql-ws';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GqlConfig,
    EventEmitterModule.forRoot(),
    RedisModule,
    PubSubModule,
    AuthModule,
    UsersModule,
    AddressModule,
    ErrandsModule,
    WalletModule,
    ChatModule,
    ApplicationModule,
    ServiceModule,
    ClientModule,
    RatingModule,
    PaymentGatewayModule,
    OrganizationModule,
    NotificationModule,
    VerificationModule,
    TrustedCircleModule,
    EmailModule,
    FirebaseModule,
    PushModule,
    ProviderModule,
    PresenceModule,
  ],
  controllers: [AppController],
  providers: [AppService, RatingResolver],
})
export class AppModule {}
