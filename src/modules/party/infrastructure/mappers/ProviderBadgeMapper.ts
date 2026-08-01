import { Injectable } from '@nestjs/common';
import {
  BadgeType,
  PartyId,
  ProviderBadge,
  ProviderBadgeId,
} from '@module/party';
import { Prisma, ProviderBadge as PrismaProviderBadge } from '@prisma/client';

@Injectable()
export class ProviderBadgeMapper {
  toDomain(row: PrismaProviderBadge): ProviderBadge {
    return new ProviderBadge(
      ProviderBadgeId.fromString(row.id),
      PartyId.fromString(row.partyId),
      row.badgeType as BadgeType,
      PartyId.fromString(row.awardedByOrganizationId),
      row.period,
      row.awardedAt,
    );
  }

  toPersistence(badge: ProviderBadge): Prisma.ProviderBadgeCreateInput {
    return {
      id: badge.id.value,
      partyId: badge.partyId.value,
      badgeType: badge.badgeType,
      awardedByOrganizationId: badge.awardedByOrganizationId.value,
      period: badge.period,
      awardedAt: badge.awardedAt,
    };
  }
}
