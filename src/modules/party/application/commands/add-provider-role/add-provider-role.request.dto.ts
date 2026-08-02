import { ProviderTier } from '@module/party';

export interface AddProviderRoleRequestDto {
  partyId: string;
}

export interface AddProviderRoleResponseDto {
  partyId: string;
  tier: ProviderTier;
}
