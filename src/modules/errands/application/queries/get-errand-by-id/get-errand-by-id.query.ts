import { Query } from '@nestjs/cqrs';
import { ErrandDetailResponseDto, GetErrandByIdRequestDto } from '.';

export class GetErrandByIdQuery extends Query<ErrandDetailResponseDto> {
  constructor(public readonly payload: GetErrandByIdRequestDto) {
    super();
  }
}
