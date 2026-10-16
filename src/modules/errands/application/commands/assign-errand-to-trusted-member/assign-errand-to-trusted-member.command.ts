import { Command } from '@nestjs/cqrs';
import {
  AssignErrandToTrustedMemberRequestDto,
  AssignErrandToTrustedMemberResponseDto,
} from './assign-errand-to-trusted-member.request.dto';

export class AssignErrandToTrustedMemberCommand extends Command<AssignErrandToTrustedMemberResponseDto> {
  constructor(public readonly payload: AssignErrandToTrustedMemberRequestDto) {
    super();
  }
}
