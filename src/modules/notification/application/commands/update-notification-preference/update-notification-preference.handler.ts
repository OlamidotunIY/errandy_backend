import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  NotificationPreferenceResponseDto,
  UpdateNotificationPreferenceCommand,
} from '.';
import {
  INotificationPreferenceRepository,
  NotificationPreference,
} from '@module/notification/domain';
import { ILogger } from '@src/common';

@CommandHandler(UpdateNotificationPreferenceCommand)
export class UpdateNotificationPreferenceHandler implements ICommandHandler<UpdateNotificationPreferenceCommand> {
  constructor(
    private readonly preferenceRepository: INotificationPreferenceRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: UpdateNotificationPreferenceCommand,
  ): Promise<NotificationPreferenceResponseDto> {
    const { userId, emailEnabled, smsEnabled, pushEnabled } = command.payload;

    const preference =
      (await this.preferenceRepository.findByUserId(userId)) ??
      NotificationPreference.create(userId);

    preference.updatePreferences(emailEnabled, smsEnabled, pushEnabled);

    await this.preferenceRepository.save(preference);

    this.logger.info('Notification preferences updated', { userId });

    return {
      userId: preference.userId,
      emailEnabled: preference.emailEnabled,
      smsEnabled: preference.smsEnabled,
      pushEnabled: preference.pushEnabled,
      updatedAt: preference.updatedAt,
    };
  }
}
