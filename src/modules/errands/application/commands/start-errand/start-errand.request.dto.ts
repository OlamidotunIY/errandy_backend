export interface StartErrandRequestDto {
  errandId: string;
  providerPartyId: string;
}

export interface StartErrandResponseDto {
  errandId: string;
  status: string;
}
