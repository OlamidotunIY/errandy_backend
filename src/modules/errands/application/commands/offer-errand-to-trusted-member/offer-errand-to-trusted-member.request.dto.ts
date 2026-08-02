export interface OfferErrandToTrustedMemberRequestDto {
  errandId: string;
  offeredToPartyId: string;
  proposedAmountMinorUnits: number;
  currency: string;
}

export interface OfferErrandToTrustedMemberResponseDto {
  applicationId: string;
}
