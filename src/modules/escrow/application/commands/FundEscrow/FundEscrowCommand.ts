import { FundEscrowPayload, FundEscrowResult } from 'src/modules/escrow';
import { Command } from '@nestjs/cqrs';

class FundEscrowCommand extends Command<FundEscrowResult> {
  constructor(public readonly payload: FundEscrowPayload) {
    super();
  }
}

export { FundEscrowCommand };
