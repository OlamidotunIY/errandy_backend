export interface ConfirmAssignmentCompletionRequestDto {
  errandAssignmentId: string;
  profileId: string;
  proofUrl?: string;
}

export interface ConfirmAssignmentCompletionResponseDto {
  errandAssignmentId: string;
  status: string;
  errandReadyForCompletion: boolean;
}
