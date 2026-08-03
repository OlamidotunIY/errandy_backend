import { NotificationLog } from '../entities';

export abstract class INotificationLogRepository {
  abstract save(log: NotificationLog): Promise<void>;
  abstract findById(id: string): Promise<NotificationLog | null>;
  abstract findByUserId(
    userId: string,
    pagination: { limit: number; cursor?: string },
  ): Promise<{ items: NotificationLog[]; nextCursor?: string }>;
  abstract findFailed(): Promise<NotificationLog[]>;
}
