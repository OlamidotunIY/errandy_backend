import { Query } from '@nestjs/cqrs';
import {
  GetOrgFacingProviderProfileRequestDto,
  GetOrgFacingProviderProfileResponseDto,
} from './get-org-facing-provider-profile.request.dto';

export class GetOrgFacingProviderProfileQuery extends Query<GetOrgFacingProviderProfileResponseDto> {
  constructor(public readonly payload: GetOrgFacingProviderProfileRequestDto) {
    super();
  }
}
