export interface CreateOrganizationPartyRequestDto {
  ownerId: string;
  name: string;
  businessRegistrationNumber: string;
  marketId: string;
}

export interface CreateOrganizationPartyResponseDto {
  partyId: string;
}
