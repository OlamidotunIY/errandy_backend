import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendNotificationCommand, SendNotificationResponseDto } from './';
import {
  INotificationLogRepository,
  INotificationPreferenceRepository,
  NotificationLog,
  NotificationPreference,
} from '@module/notification/domain';
import {
  EmailAdapter,
  PushNotificationAdapter,
  SmsAdapter,
} from '@module/notification/infrastructure';
import { ILogger } from '@src/common';

@CommandHandler(SendNotificationCommand)
export class SendNotificationHandler implements ICommandHandler<SendNotificationCommand> {
  constructor(
    private readonly preferenceRepository: INotificationPreferenceRepository,
    private readonly logRepository: INotificationLogRepository,
    private readonly emailAdapter: EmailAdapter,
    private readonly smsAdapter: SmsAdapter,
    private readonly pushNotificationAdapter: PushNotificationAdapter,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: SendNotificationCommand,
  ): Promise<SendNotificationResponseDto> {
    const { userId, type, channel, payload } = command.payload;

    const preference =
      (await this.preferenceRepository.findByUserId(userId)) ??
      NotificationPreference.create(userId);

    if (!preference.isChannelEnabled(channel)) {
      this.logger.info('Notification skipped: channel disabled by user', {
        userId,
        type,
        channel,
      });
      return { status: 'SKIPPED' };
    }

    const log = NotificationLog.create(userId, type, channel, payload);

    try {
      switch (channel) {
        case 'EMAIL':
          await this.emailAdapter.send(payload);
          break;
        case 'SMS':
          await this.smsAdapter.send(payload);
          break;
        case 'PUSH':
          await this.pushNotificationAdapter.send(payload);
          break;
      }

      await this.logRepository.save(log);

      return { notificationLogId: log.id.value, status: 'SENT' };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'unknown delivery error';

      log.markFailed(reason);
      await this.logRepository.save(log);

      this.logger.error(
        'Notification delivery failed',
        error instanceof Error ? error : undefined,
        { userId, type, channel },
      );

      return { notificationLogId: log.id.value, status: 'FAILED' };
    }
  }
}
