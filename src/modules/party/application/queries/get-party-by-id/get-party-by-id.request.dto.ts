import { PartyKind, ProviderTier } from '@module/party';

export interface GetPartyByIdRequestDto {
  partyId: string;
}

export interface GetPartyByIdResponseDto {
  id: string;
  kind: PartyKind;
  marketId: string;
  isActive: boolean;
  personUserId?: string;
  organizationName?: string;
  providerTier?: ProviderTier;
}
