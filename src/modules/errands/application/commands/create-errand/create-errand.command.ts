import { Command } from '@nestjs/cqrs';
import { CreateErrandRequestDto, CreateErrandResponseDto } from './create-errand.request.dto';

export class CreateErrandCommand extends Command<CreateErrandResponseDto> {
  constructor(public readonly payload: CreateErrandRequestDto) {
    super();
  }
}
