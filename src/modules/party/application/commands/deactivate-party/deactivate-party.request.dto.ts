export interface DeactivatePartyRequestDto {
  partyId: string;
}

export interface DeactivatePartyResponseDto {
  partyId: string;
  isActive: boolean;
}
