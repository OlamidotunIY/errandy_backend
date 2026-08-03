export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';

export interface SendNotificationRequestDto {
  userId: string;
  type: string;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
}

export interface SendNotificationResponseDto {
  notificationLogId?: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
}
