import { Query } from '@nestjs/cqrs';
import {
  GetOrgFacingProviderProfileRequestDto,
  GetOrgFacingProviderProfileResponseDto,
} from '.';

export class GetOrgFacingProviderProfileQuery extends Query<GetOrgFacingProviderProfileResponseDto> {
  constructor(public readonly payload: GetOrgFacingProviderProfileRequestDto) {
    super();
  }
}
