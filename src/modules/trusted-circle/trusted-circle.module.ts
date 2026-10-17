import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  AddTrustedMemberHandler,
  RemoveTrustedMemberHandler,
  GetTrustedCircleHandler,
} from './application';
import { ITrustedCircleRepository } from './domain';
import { PrismaTrustedCircleRepository } from './infrastructure';
import { TrustedCircleResolver } from './presentation';

@Module({
  imports: [CqrsModule],
  providers: [
    AddTrustedMemberHandler,
    RemoveTrustedMemberHandler,
    GetTrustedCircleHandler,
    {
      provide: ITrustedCircleRepository,
      useClass: PrismaTrustedCircleRepository,
    },
    TrustedCircleResolver,
  ],
  exports: [ITrustedCircleRepository],
})
export class TrustedCircleModule {}
