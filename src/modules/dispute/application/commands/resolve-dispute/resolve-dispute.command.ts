import { Command } from '@nestjs/cqrs';

export interface ResolveDisputeDto {
  disputeId: string;
  status: 'RESOLVED' | 'REJECTED';
  resolution: string;
  adminUserId: string;
}

export class ResolveDisputeCommand extends Command<void> {
  constructor(public readonly payload: ResolveDisputeDto) {
    super();
  }
}
