import { Command } from '@nestjs/cqrs';
import {
  AssignErrandToTrustedMemberRequestDto,
  AssignErrandToTrustedMemberResponseDto,
} from '.';

export class AssignErrandToTrustedMemberCommand extends Command<AssignErrandToTrustedMemberResponseDto> {
  constructor(public readonly payload: AssignErrandToTrustedMemberRequestDto) {
    super();
  }
}
