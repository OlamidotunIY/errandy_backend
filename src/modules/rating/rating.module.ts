import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  SubmitRatingHandler,
  ReactToRatingHandler,
  ReplyToRatingHandler,
  GetRatingsByRateeHandler,
  GetRatingsByErrandHandler,
  RatingPromptSaga,
} from './application';
import { IRatingRepository } from './domain';
import { PrismaRatingRepository } from './infrastructure';
import { RatingResolver } from './presentation';

@Module({
  imports: [CqrsModule],
  providers: [
    SubmitRatingHandler,
    ReactToRatingHandler,
    ReplyToRatingHandler,
    GetRatingsByRateeHandler,
    GetRatingsByErrandHandler,
    RatingPromptSaga,
    {
      provide: IRatingRepository,
      useClass: PrismaRatingRepository,
    },
    RatingResolver,
  ],
  exports: [IRatingRepository],
})
export class RatingModule {}
