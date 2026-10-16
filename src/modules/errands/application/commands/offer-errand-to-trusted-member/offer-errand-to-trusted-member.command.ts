import { Command } from '@nestjs/cqrs';
import {
  OfferErrandToTrustedMemberRequestDto,
  OfferErrandToTrustedMemberResponseDto,
} from './offer-errand-to-trusted-member.request.dto';

export class OfferErrandToTrustedMemberCommand extends Command<OfferErrandToTrustedMemberResponseDto> {
  constructor(public readonly payload: OfferErrandToTrustedMemberRequestDto) {
    super();
  }
}
