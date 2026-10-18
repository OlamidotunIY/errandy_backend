import { Query } from '@nestjs/cqrs';
import {
  SearchProvidersByServiceRequestDto,
  SearchProvidersByServiceResponseDto,
} from './search-providers-by-service.request.dto';

export class SearchProvidersByServiceQuery extends Query<SearchProvidersByServiceResponseDto> {
  constructor(public readonly payload: SearchProvidersByServiceRequestDto) {
    super();
  }
}
