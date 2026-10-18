import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  ApplicationMapper,
  PrismaApplicationRepository,
  PrismaApplicationProgressRepository,
} from './infrastructure';
import {
  IApplicationRepository,
  IAcceptApplicationProgressRepository,
  AcceptApplicationErrorClassifier,
} from './domain';
import {
  SubmitApplicationHandler,
  RequestApplicationAcceptanceHandler,
  AcceptApplicationHandler,
  RejectApplicationHandler,
  RejectOtherApplicationsHandler,
  MarkApplicationAcceptanceFailedHandler,
  GetApplicationHandler,
} from './application';
import { RejectOtherApplicationsSaga } from './application/sagas';
import { AcceptApplicationProcessor } from './application/jobs';
import {
  OnErrandOfferedHandler,
  OnPaymentFailedHandler,
  OnPaymentSucceededHandler,
} from './application/event-handlers';
import { ApplicationResolver } from './presentation';

@Module({
  imports: [CqrsModule],
  providers: [
    ApplicationMapper,
    {
      provide: IApplicationRepository,
      useClass: PrismaApplicationRepository,
    },
    {
      provide: IAcceptApplicationProgressRepository,
      useClass: PrismaApplicationProgressRepository,
    },
    AcceptApplicationErrorClassifier,
    // Command Handlers
    SubmitApplicationHandler,
    RequestApplicationAcceptanceHandler,
    AcceptApplicationHandler,
    RejectApplicationHandler,
    RejectOtherApplicationsHandler,
    MarkApplicationAcceptanceFailedHandler,
    // Query Handlers
    GetApplicationHandler,
    // Sagas & Processors
    RejectOtherApplicationsSaga,
    AcceptApplicationProcessor,
    // Event Handlers
    OnPaymentFailedHandler,
    OnPaymentSucceededHandler,
    OnErrandOfferedHandler,
    // Resolver
    ApplicationResolver,
  ],
  exports: [
    IApplicationRepository,
    IAcceptApplicationProgressRepository,
    ApplicationMapper,
  ],
})
export class ApplicationModule {}
