import { Command } from '@nestjs/cqrs';
import { CompleteErrandRequestDto, CompleteErrandResponseDto } from './complete-errand.request.dto';

export class CompleteErrandCommand extends Command<CompleteErrandResponseDto> {
  constructor(public readonly payload: CompleteErrandRequestDto) {
    super();
  }
}
