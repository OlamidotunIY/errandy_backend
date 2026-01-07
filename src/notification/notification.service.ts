import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { PrismaService } from '../prisma.service';
import { UserCreatedEvent } from '../utils/event-emitter.utils';
import { SendNotificationOptions } from './notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
    private readonly prisma: PrismaService,
  ) {}

  async sendNotification(options: SendNotificationOptions): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: options.userId },
    });

    if (!user) {
      this.logger.warn(`User not found for notification: ${options.userId}`);
      return;
    }

    if (options.push && options.fcmToken) {
      await this.pushService.sendPush(options.fcmToken, options.push);
    }

    if (options.email && user.email) {
      await this.emailService.sendEmail({
        to: user.email,
        subject: options.email.subject,
        template: options.email.template,
        html: options.email.html,
        context: {
          ...options.email.context,
          name: user.name,
        },
      });
    }
  }

  @OnEvent('user.created')
  async handleUserCreated(payload: UserCreatedEvent) {
    this.logger.log(`Sending welcome email to user ${payload.userId}`);

    try {
      await this.emailService.sendEmail({
        to: payload.email,
        subject: 'Welcome to Errandy! 🎉',
        template: 'welcome',
        context: {
          name: payload.firstName || 'there',
        },
      });

      this.logger.log(`Welcome email sent to ${payload.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${payload.email}: ${error.message}`,
      );
    }
  }
}
