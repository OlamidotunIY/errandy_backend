import { Query } from '@nestjs/cqrs';
import {
  GetPublicProviderProfileRequestDto,
  GetPublicProviderProfileResponseDto,
} from './get-public-provider-profile.request.dto';

export class GetPublicProviderProfileQuery extends Query<GetPublicProviderProfileResponseDto> {
  constructor(public readonly payload: GetPublicProviderProfileRequestDto) {
    super();
  }
}
