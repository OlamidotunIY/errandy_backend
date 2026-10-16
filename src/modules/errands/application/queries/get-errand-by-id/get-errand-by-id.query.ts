import { Query } from '@nestjs/cqrs';
import { ErrandDetailResponseDto, GetErrandByIdRequestDto } from './get-errand-by-id.request.dto';

export class GetErrandByIdQuery extends Query<ErrandDetailResponseDto> {
  constructor(public readonly payload: GetErrandByIdRequestDto) {
    super();
  }
}
