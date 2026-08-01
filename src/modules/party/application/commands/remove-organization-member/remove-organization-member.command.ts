import { Command } from '@nestjs/cqrs';
import {
  RemoveOrganizationMemberRequestDto,
  RemoveOrganizationMemberResponseDto,
} from '.';

export class RemoveOrganizationMemberCommand extends Command<RemoveOrganizationMemberResponseDto> {
  constructor(public readonly payload: RemoveOrganizationMemberRequestDto) {
    super();
  }
}
