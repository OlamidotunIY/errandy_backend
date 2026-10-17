import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  CreateErrandHandler,
  PublishErrandHandler,
  StartErrandHandler,
  CompleteErrandHandler,
  ConfirmAssignmentCompletionHandler,
  UpdateAssignmentConfirmationHandler,
  OfferErrandToTrustedMemberHandler,
  AssignErrandToTrustedMemberHandler,
  BookServiceHandler,
  GetErrandByIdHandler,
  BrowseOpenErrandsHandler,
  OnApplicationAcceptedHandler,
} from './application';
import { AutoAcceptErrandProcessor } from './application/jobs';
import { ErrandMapper, PrismaErrandRepository } from './infrastructure';
import { ErrandReadAdapter } from './infrastructure/adapters';
import { IErrandRepository } from './domain';
import { IErrandReadPort } from '@src/common';
import { ErrandsResolver } from './presentation';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    ErrandMapper,
    {
      provide: IErrandRepository,
      useClass: PrismaErrandRepository,
    },
    {
      provide: IErrandReadPort,
      useClass: ErrandReadAdapter,
    },
    // Command Handlers
    CreateErrandHandler,
    PublishErrandHandler,
    StartErrandHandler,
    CompleteErrandHandler,
    ConfirmAssignmentCompletionHandler,
    UpdateAssignmentConfirmationHandler,
    OfferErrandToTrustedMemberHandler,
    AssignErrandToTrustedMemberHandler,
    BookServiceHandler,
    // Event Handlers
    OnApplicationAcceptedHandler,
    // Query Handlers
    GetErrandByIdHandler,
    BrowseOpenErrandsHandler,
    // Jobs
    AutoAcceptErrandProcessor,
    // Resolver
    ErrandsResolver,
  ],
  exports: [IErrandReadPort],
})
export class ErrandsModule {}
