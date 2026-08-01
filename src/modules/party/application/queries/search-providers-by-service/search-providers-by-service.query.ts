import { Query } from '@nestjs/cqrs';
import {
  SearchProvidersByServiceRequestDto,
  SearchProvidersByServiceResponseDto,
} from '.';

export class SearchProvidersByServiceQuery extends Query<SearchProvidersByServiceResponseDto> {
  constructor(public readonly payload: SearchProvidersByServiceRequestDto) {
    super();
  }
}
