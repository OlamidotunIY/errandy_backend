import { Command } from '@nestjs/cqrs';
import { DeactivatePartyRequestDto, DeactivatePartyResponseDto } from './deactivate-party.request.dto';

export class DeactivatePartyCommand extends Command<DeactivatePartyResponseDto> {
  constructor(public readonly payload: DeactivatePartyRequestDto) {
    super();
  }
}
