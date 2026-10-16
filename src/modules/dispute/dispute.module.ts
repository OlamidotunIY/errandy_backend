import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PartyModule } from '@module/party';
import {
  OpenDisputeHandler,
  ResolveDisputeHandler,
  GetDisputeByIdHandler,
  GetDisputesByErrandHandler,
  ListDisputesHandler,
} from './application';
import { IDisputeRepository } from './domain';
import { PrismaDisputeRepository } from './infrastructure';
import { DisputeResolver } from './presentation';

@Module({
  imports: [CqrsModule, PartyModule],
  providers: [
    OpenDisputeHandler,
    ResolveDisputeHandler,
    GetDisputeByIdHandler,
    GetDisputesByErrandHandler,
    ListDisputesHandler,
    {
      provide: IDisputeRepository,
      useClass: PrismaDisputeRepository,
    },
    DisputeResolver,
  ],
  exports: [IDisputeRepository],
})
export class DisputeModule {}
