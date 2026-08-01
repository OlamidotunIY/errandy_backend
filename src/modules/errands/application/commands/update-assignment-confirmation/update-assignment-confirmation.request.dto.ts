export interface UpdateAssignmentConfirmationRequestDto {
  errandAssignmentId: string;
  profileId: string;
  proofUrl: string;
}

export interface UpdateAssignmentConfirmationResponseDto {
  errandAssignmentId: string;
  proofUrl: string;
}
