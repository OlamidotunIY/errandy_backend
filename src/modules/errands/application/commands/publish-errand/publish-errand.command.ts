import { Command } from '@nestjs/cqrs';
import { PublishErrandRequestDto, PublishErrandResponseDto } from '.';

export class PublishErrandCommand extends Command<PublishErrandResponseDto> {
  constructor(public readonly payload: PublishErrandRequestDto) {
    super();
  }
}
