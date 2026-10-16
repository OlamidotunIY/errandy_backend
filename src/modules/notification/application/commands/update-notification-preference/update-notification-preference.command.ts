import { Command } from '@nestjs/cqrs';
import {
  NotificationPreferenceResponseDto,
  UpdateNotificationPreferenceRequestDto,
} from './update-notification-preference.request.dto';

export class UpdateNotificationPreferenceCommand extends Command<NotificationPreferenceResponseDto> {
  constructor(public readonly payload: UpdateNotificationPreferenceRequestDto) {
    super();
  }
}
