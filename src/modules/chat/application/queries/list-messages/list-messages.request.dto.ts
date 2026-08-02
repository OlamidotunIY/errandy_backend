export interface ListMessagesRequestDto {
  threadId: string;
  limit: number;
  cursor?: string;
}

export interface ChatMessageResponseDto {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  sentAt: string;
}

export interface ListMessagesResponseDto {
  items: ChatMessageResponseDto[];
  nextCursor?: string;
}
