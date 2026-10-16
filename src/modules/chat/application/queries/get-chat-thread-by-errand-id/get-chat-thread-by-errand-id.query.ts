import { Query } from '@nestjs/cqrs';
import { ChatThreadResponseDto, GetChatThreadByErrandIdRequestDto } from './get-chat-thread-by-errand-id.request.dto';

export class GetChatThreadByErrandIdQuery extends Query<ChatThreadResponseDto | null> {
  constructor(public readonly payload: GetChatThreadByErrandIdRequestDto) {
    super();
  }
}
