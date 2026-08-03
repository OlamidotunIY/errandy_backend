import { NotificationPreference } from '../entities';

export abstract class INotificationPreferenceRepository {
  abstract save(preference: NotificationPreference): Promise<void>;
  abstract findByUserId(userId: string): Promise<NotificationPreference | null>;
}
