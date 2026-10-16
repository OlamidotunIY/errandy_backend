import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PartyModule } from '@module/party/party.module';
import { CategoryModule } from '@module/category/category.module';
import { AddressModule } from '@module/address/address.module';
import { ChatModule } from '@module/chat/chat.module';
import {
  CreateErrandHandler,
  PublishErrandHandler,
  StartErrandHandler,
  CompleteErrandHandler,
  ConfirmAssignmentCompletionHandler,
  UpdateAssignmentConfirmationHandler,
  OfferErrandToTrustedMemberHandler,
  GetErrandByIdHandler,
  BrowseOpenErrandsHandler,
} from './application';
import { ChatLifecycleSaga, RatingPromptSaga } from './application/sagas';
import { AutoAcceptErrandProcessor } from './application/jobs';
import { ErrandMapper, PrismaErrandRepository } from './infrastructure';
import { IErrandRepository } from './domain';
import { ErrandsResolver } from './presentation';

@Module({
  imports: [
    CqrsModule,
    PartyModule,
    CategoryModule,
    AddressModule,
    ChatModule,
  ],
  providers: [
    ErrandMapper,
    {
      provide: IErrandRepository,
      useClass: PrismaErrandRepository,
    },
    // Command Handlers
    CreateErrandHandler,
    PublishErrandHandler,
    StartErrandHandler,
    CompleteErrandHandler,
    ConfirmAssignmentCompletionHandler,
    UpdateAssignmentConfirmationHandler,
    OfferErrandToTrustedMemberHandler,
    // Query Handlers
    GetErrandByIdHandler,
    BrowseOpenErrandsHandler,
    // Sagas & Jobs
    ChatLifecycleSaga,
    RatingPromptSaga,
    AutoAcceptErrandProcessor,
    // Resolver
    ErrandsResolver,
  ],
  exports: [IErrandRepository, ErrandMapper],
})
export class ErrandsModule {}
