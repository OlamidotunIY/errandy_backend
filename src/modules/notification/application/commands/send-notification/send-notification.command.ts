import { Command } from '@nestjs/cqrs';
import { SendNotificationRequestDto, SendNotificationResponseDto } from '.';

export class SendNotificationCommand extends Command<SendNotificationResponseDto> {
  constructor(public readonly payload: SendNotificationRequestDto) {
    super();
  }
}
