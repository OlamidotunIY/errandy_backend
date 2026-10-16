import { Command } from '@nestjs/cqrs';
import {
  AddOrganizationMemberRequestDto,
  AddOrganizationMemberResponseDto,
} from './add-organization-member.request.dto';

export class AddOrganizationMemberCommand extends Command<AddOrganizationMemberResponseDto> {
  constructor(public readonly payload: AddOrganizationMemberRequestDto) {
    super();
  }
}
