import { FundEscrowPayload, FundEscrowResult } from './fund-escrow.result';
import { Command } from '@nestjs/cqrs';

class FundEscrowCommand extends Command<FundEscrowResult> {
  constructor(public readonly payload: FundEscrowPayload) {
    super();
  }
}

export { FundEscrowCommand };
