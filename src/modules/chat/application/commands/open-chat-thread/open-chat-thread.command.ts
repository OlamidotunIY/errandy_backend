import { Command } from '@nestjs/cqrs';
import { OpenChatThreadRequestDto, OpenChatThreadResponseDto } from '.';

export class OpenChatThreadCommand extends Command<OpenChatThreadResponseDto> {
  constructor(public readonly payload: OpenChatThreadRequestDto) {
    super();
  }
}
