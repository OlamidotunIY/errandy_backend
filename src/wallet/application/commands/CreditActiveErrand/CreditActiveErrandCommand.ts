import { Currency, EscrowId } from '@escrow';
import { UserId } from '@user';
import { WalletId } from '@wallet';
import { Command } from '@nestjs/cqrs';

class CreditActiveErrandCommand extends Command<void> {
  constructor(
    public readonly workerUserId: UserId,
    public readonly escrowId: EscrowId,
    public readonly walletId: WalletId,
    public readonly amountKobo: number,
    public readonly currency: Currency,
    public readonly gatewayReference: string,
  ) {
    super();
  }
}

export { CreditActiveErrandCommand };
