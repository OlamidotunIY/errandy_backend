import { PushNotificationPayload } from '../push/push.interface';

export interface SendNotificationOptions {
  userId: string;
  fcmToken?: string;
  push?: PushNotificationPayload;
  email?: {
    subject: string;
    template?: string;
    html?: string;
    context?: Record<string, any>;
  };
}
