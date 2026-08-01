import { Query } from '@nestjs/cqrs';
import { ChatThreadResponseDto, GetChatThreadByErrandIdRequestDto } from '.';

export class GetChatThreadByErrandIdQuery extends Query<ChatThreadResponseDto | null> {
  constructor(public readonly payload: GetChatThreadByErrandIdRequestDto) {
    super();
  }
}
