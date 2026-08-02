import { Command } from '@nestjs/cqrs';
import { AddProviderRoleRequestDto, AddProviderRoleResponseDto } from '.';

export class AddProviderRoleCommand extends Command<AddProviderRoleResponseDto> {
  constructor(public readonly payload: AddProviderRoleRequestDto) {
    super();
  }
}
