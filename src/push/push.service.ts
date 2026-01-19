import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PushNotificationPayload } from './push.interface';
import { FirebaseAdminService } from 'src/firebase/firebase-admin.service';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  onModuleInit() {
    this.firebaseAdminService.ensureInitialized();
  }

  async sendPush(
    fcmToken: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!this.firebaseAdminService.isInitialized()) {
      this.logger.warn('Firebase not initialized - skipping push notification');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);

      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Invalid FCM token: ${fcmToken}`);
      }

      return false;
    }
  }

  async sendPushToMultiple(
    fcmTokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.firebaseAdminService.isInitialized() || fcmTokens.length === 0) {
      return { successCount: 0, failureCount: fcmTokens.length };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Push sent to ${fcmTokens.length} devices: ${response.successCount} success, ${response.failureCount} failed`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Failed to send multicast push: ${error.message}`);
      return { successCount: 0, failureCount: fcmTokens.length };
    }
  }
}
