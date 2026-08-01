import { Command } from '@nestjs/cqrs';
import { CreatePersonPartyRequestDto, CreatePersonPartyResponseDto } from '.';

export class CreatePersonPartyCommand extends Command<CreatePersonPartyResponseDto> {
  constructor(public readonly payload: CreatePersonPartyRequestDto) {
    super();
  }
}
