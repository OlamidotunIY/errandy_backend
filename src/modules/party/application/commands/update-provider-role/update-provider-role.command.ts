import { Command } from '@nestjs/cqrs';
import { UpdateProviderRoleRequestDto, UpdateProviderRoleResponseDto } from './update-provider-role.request.dto';

export class UpdateProviderRoleCommand extends Command<UpdateProviderRoleResponseDto> {
  constructor(public readonly payload: UpdateProviderRoleRequestDto) {
    super();
  }
}
