import { Command } from '@nestjs/cqrs';
import { AddProviderRoleRequestDto, AddProviderRoleResponseDto } from './add-provider-role.request.dto';

export class AddProviderRoleCommand extends Command<AddProviderRoleResponseDto> {
  constructor(public readonly payload: AddProviderRoleRequestDto) {
    super();
  }
}
