import { Command } from '@nestjs/cqrs';
import { RequestTierUpgradeRequestDto, RequestTierUpgradeResponseDto } from '.';

export class RequestTierUpgradeCommand extends Command<RequestTierUpgradeResponseDto> {
  constructor(public readonly payload: RequestTierUpgradeRequestDto) {
    super();
  }
}
