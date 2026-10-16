import { Query } from '@nestjs/cqrs';
import { GetServiceByIdRequestDto, ServiceResponseDto } from './get-service-by-id.request.dto';

export class GetServiceByIdQuery extends Query<ServiceResponseDto> {
  constructor(public readonly payload: GetServiceByIdRequestDto) {
    super();
  }
}
