export interface ConfirmAssignmentCompletionRequestDto {
  errandAssignmentId: string;
  providerPartyId: string;
  proofUrl?: string;
}

export interface ConfirmAssignmentCompletionResponseDto {
  errandAssignmentId: string;
  status: string;
  errandReadyForCompletion: boolean;
}
