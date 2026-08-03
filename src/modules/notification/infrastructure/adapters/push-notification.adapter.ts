import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseAdminService } from '@src/firebase/firebase-admin.service';
import { NotificationDeliveryError } from '../../domain';

@Injectable()
export class PushNotificationAdapter {
  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  async send(payload: Record<string, unknown>): Promise<void> {
    const app = this.firebaseAdminService.ensureInitialized();
    if (!app) {
      throw new NotificationDeliveryError(
        'PUSH',
        'Firebase Admin is not configured for this deployment',
      );
    }

    const token = payload.token as string | undefined;
    const title = payload.title as string | undefined;
    const body = payload.body as string | undefined;

    if (!token || !title || !body) {
      throw new NotificationDeliveryError(
        'PUSH',
        'payload must include "token", "title" and "body"',
      );
    }

    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: (payload.data as Record<string, string>) ?? undefined,
      });
    } catch (error) {
      throw new NotificationDeliveryError(
        'PUSH',
        error instanceof Error ? error.message : 'unknown FCM error',
      );
    }
  }
}
