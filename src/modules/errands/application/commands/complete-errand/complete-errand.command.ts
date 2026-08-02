import { Command } from '@nestjs/cqrs';
import { CompleteErrandRequestDto, CompleteErrandResponseDto } from '.';

export class CompleteErrandCommand extends Command<CompleteErrandResponseDto> {
  constructor(public readonly payload: CompleteErrandRequestDto) {
    super();
  }
}
