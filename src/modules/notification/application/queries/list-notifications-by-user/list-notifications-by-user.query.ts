import { Query } from '@nestjs/cqrs';
import {
  ListNotificationsByUserRequestDto,
  ListNotificationsByUserResponseDto,
} from './list-notifications-by-user.request.dto';

export class ListNotificationsByUserQuery extends Query<ListNotificationsByUserResponseDto> {
  constructor(public readonly payload: ListNotificationsByUserRequestDto) {
    super();
  }
}
