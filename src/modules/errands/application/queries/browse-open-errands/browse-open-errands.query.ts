import { Query } from '@nestjs/cqrs';
import { BrowseOpenErrandsRequestDto, BrowseOpenErrandsResponseDto } from '.';

export class BrowseOpenErrandsQuery extends Query<BrowseOpenErrandsResponseDto> {
  constructor(public readonly payload: BrowseOpenErrandsRequestDto) {
    super();
  }
}
