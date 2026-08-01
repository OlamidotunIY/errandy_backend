import { ProviderTier } from '@module/party';

export interface SearchProvidersByServiceRequestDto {
  service: string;
  limit?: number;
}

export interface SearchProvidersByServiceResponseDto {
  providers: Array<{
    partyId: string;
    tier: ProviderTier;
    skills: string[];
    bio: string | null;
    trustedByCount: number;
    avgRatingCached: number | null;
    completedErrandsCount: number;
  }>;
}
