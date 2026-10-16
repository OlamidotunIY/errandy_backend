import { Query } from '@nestjs/cqrs';
import { BrowseOpenErrandsRequestDto, BrowseOpenErrandsResponseDto } from './browse-open-errands.request.dto';

export class BrowseOpenErrandsQuery extends Query<BrowseOpenErrandsResponseDto> {
  constructor(public readonly payload: BrowseOpenErrandsRequestDto) {
    super();
  }
}
