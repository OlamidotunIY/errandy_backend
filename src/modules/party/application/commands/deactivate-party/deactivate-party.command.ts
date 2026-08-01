import { Command } from '@nestjs/cqrs';
import { DeactivatePartyRequestDto, DeactivatePartyResponseDto } from '.';

export class DeactivatePartyCommand extends Command<DeactivatePartyResponseDto> {
  constructor(public readonly payload: DeactivatePartyRequestDto) {
    super();
  }
}
