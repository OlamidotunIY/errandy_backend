import { Command } from '@nestjs/cqrs';

export interface OpenDisputeDto {
  errandId: string;
  raisedById: string;
  providerPartyId: string;
  reason: string;
  description: string;
  evidenceUrls?: string[];
  correlationId?: string;
}

export class OpenDisputeCommand extends Command<string> {
  constructor(public readonly payload: OpenDisputeDto) {
    super();
  }
}
