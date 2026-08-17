import { DomainError } from '@src/common';

export class MarketNotFoundError extends DomainError {
  constructor(countryCode?: string) {
    super(
      countryCode
        ? `Market not found for country code: ${countryCode}`
        : 'Market not found',
      {
        code: 'MARKET_NOT_FOUND',
        statusCode: 404,
      },
    );
  }
}
