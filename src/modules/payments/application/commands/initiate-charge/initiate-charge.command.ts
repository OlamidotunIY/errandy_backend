import { Command, CommandHandler } from '@nestjs/cqrs';
import { InitiateChargeRequestDto, InitiateChargeResponseDto } from './initiate-charge.dto';

export class InitiateChargeCommand extends Command<InitiateChargeResponseDto> {
  constructor(public readonly payload: InitiateChargeRequestDto) {
    super();
  }
}
