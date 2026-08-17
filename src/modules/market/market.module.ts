import { Module } from '@nestjs/common';
import { MARKET_REPOSITORY, MarketRepository } from './';

@Module({
  providers: [
    {
      provide: MARKET_REPOSITORY,
      useClass: MarketRepository,
    },
  ],
  exports: [MARKET_REPOSITORY],
})
export class MarketModule {}
