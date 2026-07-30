import { Currency, EscrowId } from '@module/escrow';
import { Command } from '@nestjs/cqrs';
import { UserId } from '@src/users';

class ReleaseToAvailableCommand extends Command<void> {
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

export { ReleaseToAvailableCommand };
