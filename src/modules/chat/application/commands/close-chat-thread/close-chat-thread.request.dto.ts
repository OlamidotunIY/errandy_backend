export interface CloseChatThreadRequestDto {
  threadId: string;
}

export interface CloseChatThreadResponseDto {
  threadId: string;
  closedAt: string;
}
