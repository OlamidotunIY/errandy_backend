import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  SubmitVerificationStepHandler,
  ReviewVerificationStepHandler,
  GetVerificationProfileHandler,
} from './application';
import { IVerificationRepository } from './domain';
import { PrismaVerificationRepository } from './infrastructure';
import { VerificationResolver } from './presentation';

@Module({
  imports: [CqrsModule],
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
