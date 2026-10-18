import { Command } from '@nestjs/cqrs';
import { AddClientRoleRequestDto, AddClientRoleResponseDto } from './add-client-role.request.dto';

export class AddClientRoleCommand extends Command<AddClientRoleResponseDto> {
  constructor(public readonly payload: AddClientRoleRequestDto) {
    super();
  }
}
