import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReviewModule } from './review/review.module';
import { ServiceModule } from './service/service.module';
import { ApplicationModule } from './application/application.module';
import { ChatModule } from './chat/chat.module';
import { WalletModule } from './wallet/wallet.module';
import { ErrandsModule } from './errands/errands.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

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
          plugins: [ApolloServerPluginLandingPageLocalDefault()],
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          subscription: {
            'graphql-ws': true,
            'subscriptions-transport-ws': true,
          },
          introspection: !isProduction,
          // onConnect: (connectionParams) => {
          //   return connectionParams;
          // },
          // context: ({ req, res, connection }) => {
          //   if (connection) {
          //     return { req, res, user: connection.context.user }; // Injecting pubSub into context
          //   }
          //   return { req, res };
          // },
        };
      },
    }),
    AuthModule,
    UsersModule,
    ErrandsModule,
    WalletModule,
    ChatModule,
    ApplicationModule,
    ServiceModule,
    ReviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
