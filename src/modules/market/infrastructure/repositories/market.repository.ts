import { Injectable } from '@nestjs/common';
import { PrismaClient, CountryCode } from '@prisma/client';
import { IMarketRepository, Market, MarketId, MarketMapper } from '../../';

@Injectable()
export class MarketRepository implements IMarketRepository {
  private readonly prisma = new PrismaClient(); // In a real app we'd inject PrismaService, but here we can instantiate or inject

  async findById(id: MarketId): Promise<Market | null> {
    const market = await this.prisma.market.findUnique({
      where: { id: id.value },
    });

    if (!market) return null;
    return MarketMapper.toDomain(market);
  }

  async findByCountryCode(countryCode: string): Promise<Market | null> {
    const market = await this.prisma.market.findUnique({
      where: { countryCode: countryCode as CountryCode },
    });

    if (!market) return null;
    return MarketMapper.toDomain(market);
  }

  async findAll(): Promise<Market[]> {
    const markets = await this.prisma.market.findMany();
    return markets.map(MarketMapper.toDomain);
  }
}
