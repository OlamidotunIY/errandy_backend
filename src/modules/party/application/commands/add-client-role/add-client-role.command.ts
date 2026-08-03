import { Command } from '@nestjs/cqrs';
import { AddClientRoleRequestDto, AddClientRoleResponseDto } from '.';

export class AddClientRoleCommand extends Command<AddClientRoleResponseDto> {
  constructor(public readonly payload: AddClientRoleRequestDto) {
    super();
  }
}
