import { Query } from '@nestjs/cqrs';
import { ListMessagesRequestDto, ListMessagesResponseDto } from '.';

export class ListMessagesQuery extends Query<ListMessagesResponseDto> {
  constructor(public readonly payload: ListMessagesRequestDto) {
    super();
  }
}
