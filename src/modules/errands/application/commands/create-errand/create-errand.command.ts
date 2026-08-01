import { Command } from '@nestjs/cqrs';
import { CreateErrandRequestDto, CreateErrandResponseDto } from '.';

export class CreateErrandCommand extends Command<CreateErrandResponseDto> {
  constructor(public readonly payload: CreateErrandRequestDto) {
    super();
  }
}
