import { Command } from '@nestjs/cqrs';
import {
  CreateOrganizationPartyRequestDto,
  CreateOrganizationPartyResponseDto,
} from './create-organization-party.request.dto';

export class CreateOrganizationPartyCommand extends Command<CreateOrganizationPartyResponseDto> {
  constructor(public readonly payload: CreateOrganizationPartyRequestDto) {
    super();
  }
}
