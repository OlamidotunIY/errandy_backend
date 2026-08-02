import { Query } from '@nestjs/cqrs';
import { GetPartyByIdRequestDto, GetPartyByIdResponseDto } from '.';

export class GetPartyByIdQuery extends Query<GetPartyByIdResponseDto> {
  constructor(public readonly payload: GetPartyByIdRequestDto) {
    super();
  }
}
