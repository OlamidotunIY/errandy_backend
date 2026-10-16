import { Command } from '@nestjs/cqrs';
import { CreatePersonPartyRequestDto, CreatePersonPartyResponseDto } from './create-person-party.request.dto';

export class CreatePersonPartyCommand extends Command<CreatePersonPartyResponseDto> {
  constructor(public readonly payload: CreatePersonPartyRequestDto) {
    super();
  }
}
