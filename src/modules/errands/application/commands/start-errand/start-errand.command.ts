import { Command } from '@nestjs/cqrs';
import { StartErrandRequestDto, StartErrandResponseDto } from './start-errand.request.dto';

export class StartErrandCommand extends Command<StartErrandResponseDto> {
  constructor(public readonly payload: StartErrandRequestDto) {
    super();
  }
}
