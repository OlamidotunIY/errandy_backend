import { Query } from '@nestjs/cqrs';
import {
  ListNotificationsByUserRequestDto,
  ListNotificationsByUserResponseDto,
} from '.';

export class ListNotificationsByUserQuery extends Query<ListNotificationsByUserResponseDto> {
  constructor(public readonly payload: ListNotificationsByUserRequestDto) {
    super();
  }
}
