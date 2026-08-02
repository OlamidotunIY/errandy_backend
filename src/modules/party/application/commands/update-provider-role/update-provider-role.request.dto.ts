import { ProviderTier } from '@module/party';

export interface UpdateProviderRoleRequestDto {
  partyId: string;
  bio?: string;
  skills?: string[];
  addToSkills?: boolean;
  tier?: ProviderTier;
}

export interface UpdateProviderRoleResponseDto {
  partyId: string;
  tier: ProviderTier;
  bio?: string;
  skills: string[];
}
