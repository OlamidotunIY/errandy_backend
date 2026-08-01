export interface SendMessageRequestDto {
  threadId: string;
  senderId: string;
  content: string;
  isProviderSender?: boolean;
}

export interface SendMessageResponseDto {
  messageId: string;
  sentAt: string;
}
