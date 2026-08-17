import { Market as PrismaMarket } from '@prisma/client';
import { Market, MarketId } from '../../';

export class MarketMapper {
  static toDomain(prismaMarket: PrismaMarket): Market {
    return Market.reconstitute({
      id: MarketId.fromString(prismaMarket.id),
      countryCode: prismaMarket.countryCode,
      currency: prismaMarket.currency,
      verificationChargeAmountMinorUnits: prismaMarket.verificationChargeAmountMinorUnits,
      createdAt: prismaMarket.createdAt,
      updatedAt: prismaMarket.updatedAt,
    });
  }

  static toPersistence(market: Market): PrismaMarket {
    return {
      id: market.id.value,
      countryCode: market.countryCode,
      currency: market.currency,
      verificationChargeAmountMinorUnits: market.verificationChargeAmountMinorUnits,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
    };
  }
}
