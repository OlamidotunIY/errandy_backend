import { Command } from '@nestjs/cqrs';
import { RequestTierUpgradeRequestDto, RequestTierUpgradeResponseDto } from './request-tier-upgrade.request.dto';

export class RequestTierUpgradeCommand extends Command<RequestTierUpgradeResponseDto> {
  constructor(public readonly payload: RequestTierUpgradeRequestDto) {
    super();
  }
}
