import { Query } from '@nestjs/cqrs';
import { GetPartyByIdRequestDto, GetPartyByIdResponseDto } from './get-party-by-id.request.dto';

export class GetPartyByIdQuery extends Query<GetPartyByIdResponseDto> {
  constructor(public readonly payload: GetPartyByIdRequestDto) {
    super();
  }
}
