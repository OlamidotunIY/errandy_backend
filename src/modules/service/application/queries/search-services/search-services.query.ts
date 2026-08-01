import { Query } from '@nestjs/cqrs';
import { SearchServicesRequestDto } from '.';
import { ServiceResponseDto } from '../get-service-by-id';

export class SearchServicesQuery extends Query<ServiceResponseDto[]> {
  constructor(public readonly payload: SearchServicesRequestDto) {
    super();
  }
}
