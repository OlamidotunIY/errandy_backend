import { Module } from '@nestjs/common';
import { RatingService } from './rating.service';
import { RatingResolver } from './rating.resolver';

@Module({
  providers: [RatingService, RatingResolver]
})
export class RatingModule {}
