import { Command } from '@nestjs/cqrs';
import { UpdateProviderRoleRequestDto, UpdateProviderRoleResponseDto } from '.';

export class UpdateProviderRoleCommand extends Command<UpdateProviderRoleResponseDto> {
  constructor(public readonly payload: UpdateProviderRoleRequestDto) {
    super();
  }
}
