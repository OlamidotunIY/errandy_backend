export interface GetChatThreadByErrandIdRequestDto {
  errandId: string;
}

export interface ChatThreadResponseDto {
  id: string;
  errandId: string;
  participantIds: string[];
  createdAt: string;
  closedAt?: string;
  firstResponseAt?: string;
}
