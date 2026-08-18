import { Market as PrismaMarket, CountryCode, Currency } from '@prisma/client';
import { Market, MarketId } from '../../';

export class MarketMapper {
  static toDomain(prismaMarket: PrismaMarket): Market {
    return Market.reconstitute({
      id: MarketId.fromString(prismaMarket.id),
      countryCode: prismaMarket.countryCode,
      currency: prismaMarket.currency,
      verificationChargeAmountMinorUnits:
        prismaMarket.verificationChargeAmountMinorUnits,
      createdAt: prismaMarket.createdAt,
      updatedAt: prismaMarket.updatedAt,
    });
  }

  static toPersistence(market: Market): PrismaMarket {
    return {
      id: market.id.value,
      countryCode: market.countryCode as CountryCode,
      currency: market.currency as Currency,
      verificationChargeAmountMinorUnits:
        market.verificationChargeAmountMinorUnits,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
    };
  }
}
