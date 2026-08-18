import { Market, MarketId } from '../';

export const MARKET_REPOSITORY = 'MARKET_REPOSITORY';

export interface IMarketRepository {
  findById(id: MarketId): Promise<Market | null>;
  findByCountryCode(countryCode: string): Promise<Market | null>;
  findAll(): Promise<Market[]>;
}
