export interface ListNotificationsByUserRequestDto {
  userId: string;
  limit: number;
  cursor?: string;
}

export interface NotificationLogResponseDto {
  id: string;
  type: string;
  channel: string;
  status: 'SENT' | 'FAILED';
  failureReason: string | null;
  createdAt: Date;
}

export interface ListNotificationsByUserResponseDto {
  items: NotificationLogResponseDto[];
  nextCursor?: string;
}
