export interface OpenChatThreadRequestDto {
  errandId: string;
  participantIds: string[];
}

export interface OpenChatThreadResponseDto {
  threadId: string;
}
