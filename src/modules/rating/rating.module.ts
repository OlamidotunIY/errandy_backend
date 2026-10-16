import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PartyModule } from '@module/party';
import {
  SubmitRatingHandler,
  ReactToRatingHandler,
  ReplyToRatingHandler,
  GetRatingsByRateeHandler,
  GetRatingsByErrandHandler,
} from './application';
import { IRatingRepository } from './domain';
import { PrismaRatingRepository } from './infrastructure';
import { RatingResolver } from './presentation';

@Module({
  imports: [CqrsModule, PartyModule],
  providers: [
    SubmitRatingHandler,
    ReactToRatingHandler,
    ReplyToRatingHandler,
    GetRatingsByRateeHandler,
    GetRatingsByErrandHandler,
    {
      provide: IRatingRepository,
      useClass: PrismaRatingRepository,
    },
    RatingResolver,
  ],
  exports: [IRatingRepository],
})
export class RatingModule {}
