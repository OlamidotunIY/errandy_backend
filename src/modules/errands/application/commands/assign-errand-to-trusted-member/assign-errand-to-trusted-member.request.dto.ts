export interface AssignErrandToTrustedMemberRequestDto {
  clientId: string;
  categoryId: string;
  title: string;
  description: string;
  addressId: string;
  budget: { amountMinorUnits: number; currency: string };
  offeredToPartyId: string;
  location?: { latitude: number; longitude: number };
}

export interface AssignErrandToTrustedMemberResponseDto {
  errandId: string;
  applicationId: string;
}
