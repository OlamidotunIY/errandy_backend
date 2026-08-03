import { Command, CommandHandler } from '@nestjs/cqrs';
import { InitiateChargeRequestDto, InitiateChargeResponseDto } from './';

export class InitiateChargeCommand extends Command<InitiateChargeResponseDto> {
  constructor(public readonly payload: InitiateChargeRequestDto) {
    super();
  }
}
