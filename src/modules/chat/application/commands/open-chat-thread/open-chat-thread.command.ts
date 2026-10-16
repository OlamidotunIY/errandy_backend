import { Command } from '@nestjs/cqrs';
import { OpenChatThreadRequestDto, OpenChatThreadResponseDto } from './open-chat-thread.request.dto';

export class OpenChatThreadCommand extends Command<OpenChatThreadResponseDto> {
  constructor(public readonly payload: OpenChatThreadRequestDto) {
    super();
  }
}
