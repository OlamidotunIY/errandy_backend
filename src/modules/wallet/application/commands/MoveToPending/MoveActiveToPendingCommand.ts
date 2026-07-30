import { Currency, EscrowId } from 'src/modules/escrow';
import { UserId } from '@user';
import { Command } from '@nestjs/cqrs';

class MoveActiveToPendingCommand extends Command<void> {
  constructor(
    public readonly workerUserId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
    public readonly currency: Currency,
    public readonly correlationId: string,
  ) {
    super();
  }
}

export { MoveActiveToPendingCommand };
