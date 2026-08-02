import { BadgeType, ProviderTier } from '@module/party';

export interface GetOrgFacingProviderProfileRequestDto {
  partyId: string;
  requestingOrganizationId: string;
}

export interface GetOrgFacingProviderProfileResponseDto {
  partyId: string;
  bio: string | null;
  skills: string[];
  tier: ProviderTier;
  trustedByCount: number;
  avgRatingCached: number | null;
  completedErrandsCount: number;
  disputedErrandsCount: number;
  avgResponseTimeSeconds: number | null;
  badges: Array<{
    badgeType: BadgeType;
    awardedByOrganizationId: string;
    period: string;
    awardedAt: Date;
  }>;
}
