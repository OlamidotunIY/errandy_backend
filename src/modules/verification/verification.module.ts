import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PartyModule } from '@module/party';
import {
  SubmitVerificationStepHandler,
  ReviewVerificationStepHandler,
  GetVerificationProfileHandler,
} from './application';
import { IVerificationRepository } from './domain';
import { PrismaVerificationRepository } from './infrastructure';
import { VerificationResolver } from './presentation';

@Module({
  imports: [CqrsModule, PartyModule],
  providers: [
    SubmitVerificationStepHandler,
    ReviewVerificationStepHandler,
    GetVerificationProfileHandler,
    {
      provide: IVerificationRepository,
      useClass: PrismaVerificationRepository,
    },
    VerificationResolver,
  ],
  exports: [IVerificationRepository],
})
export class VerificationModule {}
