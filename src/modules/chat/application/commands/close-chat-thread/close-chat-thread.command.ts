import { Command } from '@nestjs/cqrs';
import { CloseChatThreadRequestDto, CloseChatThreadResponseDto } from './close-chat-thread.request.dto';

export class CloseChatThreadCommand extends Command<CloseChatThreadResponseDto> {
  constructor(public readonly payload: CloseChatThreadRequestDto) {
    super();
  }
}
