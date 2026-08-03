export interface UpdateAssignmentConfirmationRequestDto {
  errandAssignmentId: string;
  providerPartyId: string;
  proofUrl: string;
}

export interface UpdateAssignmentConfirmationResponseDto {
  errandAssignmentId: string;
  proofUrl: string;
}
