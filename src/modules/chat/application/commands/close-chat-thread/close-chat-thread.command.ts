import { Command } from '@nestjs/cqrs';
import { CloseChatThreadRequestDto, CloseChatThreadResponseDto } from '.';

export class CloseChatThreadCommand extends Command<CloseChatThreadResponseDto> {
  constructor(public readonly payload: CloseChatThreadRequestDto) {
    super();
  }
}
