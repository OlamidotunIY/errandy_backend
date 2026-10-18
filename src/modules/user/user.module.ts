import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IUserReadPort } from '@src/common';
import { BetterAuthIntegration } from './infrastructure/adapters/better-auth.hooks';
import { IUserRepository } from './domain';
import { PrismaUserRepository, UserMapper, UserReadAdapter } from './infrastructure';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    BetterAuthIntegration,
    UserMapper,
    {
      provide: IUserRepository,
      useClass: PrismaUserRepository,
    },
    UserReadAdapter,
    {
      provide: IUserReadPort,
      useClass: UserReadAdapter,
    },
  ],
  exports: [IUserReadPort, BetterAuthIntegration],
})
export class UserModule {}
