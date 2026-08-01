import { Query } from '@nestjs/cqrs';
import {
  GetPublicProviderProfileRequestDto,
  GetPublicProviderProfileResponseDto,
} from '.';

export class GetPublicProviderProfileQuery extends Query<GetPublicProviderProfileResponseDto> {
  constructor(public readonly payload: GetPublicProviderProfileRequestDto) {
    super();
  }
}
