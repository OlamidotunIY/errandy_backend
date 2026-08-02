import { Command } from '@nestjs/cqrs';
import {
  AddOrganizationMemberRequestDto,
  AddOrganizationMemberResponseDto,
} from '.';

export class AddOrganizationMemberCommand extends Command<AddOrganizationMemberResponseDto> {
  constructor(public readonly payload: AddOrganizationMemberRequestDto) {
    super();
  }
}
