import { Command } from '@nestjs/cqrs';
import { AwardBadgeRequestDto, AwardBadgeResponseDto } from '.';

export class AwardBadgeCommand extends Command<AwardBadgeResponseDto> {
  constructor(public readonly payload: AwardBadgeRequestDto) {
    super();
  }
}
