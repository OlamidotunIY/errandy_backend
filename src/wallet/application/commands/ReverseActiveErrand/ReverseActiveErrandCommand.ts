import { Currency, EscrowId } from '@escrow';
import { UserId } from '@user';
import { Command } from '@nestjs/cqrs';

class ReverseActiveErrandCommand extends Command<void> {
  constructor(
    public readonly workerUserId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
    public readonly currency: Currency,
    public readonly gatewayReference: string,
  ) {
    super();
  }
}

export { ReverseActiveErrandCommand };
