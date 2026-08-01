import { Command } from '@nestjs/cqrs';
import {
  OfferErrandToTrustedMemberRequestDto,
  OfferErrandToTrustedMemberResponseDto,
} from '.';

export class OfferErrandToTrustedMemberCommand extends Command<OfferErrandToTrustedMemberResponseDto> {
  constructor(public readonly payload: OfferErrandToTrustedMemberRequestDto) {
    super();
  }
}
