import { Injectable } from '@nestjs/common';
import { IProviderBadgeRepository, ProviderBadge } from '@module/party';
import { PrismaService } from '@src/prisma/prisma.service';
import { ProviderBadgeMapper } from '../mappers';

@Injectable()
export class PrismaProviderBadgeRepository implements IProviderBadgeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ProviderBadgeMapper,
  ) {}

  async save(badge: ProviderBadge): Promise<void> {
    const existing = await this.prisma.providerBadge.findUnique({
      where: { id: badge.id.value },
    });

    if (existing) {
      await this.prisma.providerBadge.update({
        where: { id: badge.id.value },
        data: this.mapper.toPersistence(badge),
      });
      return;
    }

    await this.prisma.providerBadge.create({
      data: this.mapper.toPersistence(badge),
    });
  }

  async findByPartyId(partyId: string): Promise<ProviderBadge[]> {
    const rows = await this.prisma.providerBadge.findMany({
      where: { partyId },
      orderBy: {
        awardedAt: 'desc',
      },
    });

    return rows.map((row) => this.mapper.toDomain(row));
  }
}
