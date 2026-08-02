import { ProviderTier } from '@module/party';

export interface GetPublicProviderProfileRequestDto {
  partyId: string;
}

export interface GetPublicProviderProfileResponseDto {
  partyId: string;
  bio: string | null;
  skills: string[];
  tier: ProviderTier;
  trustedByCount: number;
  avgRatingCached: number | null;
  completedErrandsCount: number;
}
