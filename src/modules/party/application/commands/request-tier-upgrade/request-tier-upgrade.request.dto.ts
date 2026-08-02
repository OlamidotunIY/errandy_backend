import { ProviderTier } from '@module/party';

export interface RequestTierUpgradeRequestDto {
  partyId: string;
  targetTier: ProviderTier;
}

export interface RequestTierUpgradeResponseDto {
  partyId: string;
  tier: ProviderTier;
}
