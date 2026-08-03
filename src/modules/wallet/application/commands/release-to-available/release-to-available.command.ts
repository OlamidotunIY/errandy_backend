import { Currency, EscrowId, Money } from '@module/escrow';
import { Command } from '@nestjs/cqrs';
import { UserId } from '@module/user';

class ReleaseToAvailableCommand extends Command<void> {
  constructor(
    public readonly workerUserId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amount: Money,
    public readonly currency: Currency,
    public readonly correlationId: string,
  ) {
    super();
  }
}

export { ReleaseToAvailableCommand };
