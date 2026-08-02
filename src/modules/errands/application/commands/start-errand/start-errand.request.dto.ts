export interface StartErrandRequestDto {
  errandId: string;
  profileId: string;
}

export interface StartErrandResponseDto {
  errandId: string;
  status: string;
}
