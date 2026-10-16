import { Command } from '@nestjs/cqrs';
import { SendMessageRequestDto, SendMessageResponseDto } from './send-message.request.dto';

export class SendMessageCommand extends Command<SendMessageResponseDto> {
  constructor(public readonly payload: SendMessageRequestDto) {
    super();
  }
}
