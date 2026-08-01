import { Command } from '@nestjs/cqrs';
import {
  CreateOrganizationPartyRequestDto,
  CreateOrganizationPartyResponseDto,
} from '.';

export class CreateOrganizationPartyCommand extends Command<CreateOrganizationPartyResponseDto> {
  constructor(public readonly payload: CreateOrganizationPartyRequestDto) {
    super();
  }
}
