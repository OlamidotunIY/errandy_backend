import { Command } from '@nestjs/cqrs';
import {
  NotificationPreferenceResponseDto,
  UpdateNotificationPreferenceRequestDto,
} from '.';

export class UpdateNotificationPreferenceCommand extends Command<NotificationPreferenceResponseDto> {
  constructor(public readonly payload: UpdateNotificationPreferenceRequestDto) {
    super();
  }
}
