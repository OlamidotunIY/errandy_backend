import { Query } from '@nestjs/cqrs';
import { GetServiceByIdRequestDto, ServiceResponseDto } from '.';

export class GetServiceByIdQuery extends Query<ServiceResponseDto> {
  constructor(public readonly payload: GetServiceByIdRequestDto) {
    super();
  }
}
