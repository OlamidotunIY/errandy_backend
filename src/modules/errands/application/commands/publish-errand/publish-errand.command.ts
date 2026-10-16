import { Command } from '@nestjs/cqrs';
import { PublishErrandRequestDto, PublishErrandResponseDto } from './publish-errand.request.dto';

export class PublishErrandCommand extends Command<PublishErrandResponseDto> {
  constructor(public readonly payload: PublishErrandRequestDto) {
    super();
  }
}
