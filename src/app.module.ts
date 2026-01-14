import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressModule } from './address/address.module';
import { ReviewModule } from './review/review.module';
import { ServiceModule } from './service/service.module';
import { ApplicationModule } from './application/application.module';
import { ChatModule } from './chat/chat.module';
import { WalletModule } from './wallet/wallet.module';
import { ErrandsModule } from './errands/errands.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      imports: [ConfigModule, AppModule],
      inject: [ConfigService],
      driver: ApolloDriver,
      useFactory: async (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        return {
          installSubscriptionHandlers: true,
          playground: false,
          plugins: [
            ApolloServerPluginLandingPageLocalDefault(),
            {
              async requestDidStart() {
                return {
                  async didResolveOperation(requestContext) {
                    // console.log(
                    //   'GraphQL Operation:',
                    //   requestContext.operationName,
                    // );
                    // console.log(
                    //   'GraphQL Variables:',
                    //   JSON.stringify(requestContext.request.variables, null, 2),
                    // );
                  },
                };
              },
            },
          ],
          autoSchemaFile: isProduction
            ? true
            : join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          subscription: {
            'graphql-ws': true,
            'subscriptions-transport-ws': true,
          },
          introspection: !isProduction,
        };
      },
    }),
    EventEmitterModule.forRoot(),
    PubSubModule,
    AuthModule,
    UsersModule,
    AddressModule,
    ErrandsModule,
    WalletModule,
    ChatModule,
    ApplicationModule,
    ServiceModule,
    ReviewModule,
    ClientModule,
    RatingModule,
    PaymentGatewayModule,
    OrganizationModule,
    NotificationModule,
    VerificationModule,
    TrustedCircleModule,
    EmailModule,
    PushModule,
    ProviderModule,
  ],
  controllers: [AppController],
  providers: [AppService, RatingResolver],
})
export class AppModule {}
