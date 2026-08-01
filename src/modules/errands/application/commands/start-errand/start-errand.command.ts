import { Command } from '@nestjs/cqrs';
import { StartErrandRequestDto, StartErrandResponseDto } from '.';

export class StartErrandCommand extends Command<StartErrandResponseDto> {
  constructor(public readonly payload: StartErrandRequestDto) {
    super();
  }
}
