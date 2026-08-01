import { BadgeType } from '@module/party';

export interface AwardBadgeRequestDto {
  partyId: string;
  badgeType: BadgeType;
  awardedByOrganizationId: string;
  period: string;
}

export interface AwardBadgeResponseDto {
  badgeId: string;
  partyId: string;
  badgeType: BadgeType;
}
