import { EscrowId, Money } from '@module/escrow';
import { WalletId } from '@module/wallet/domain';
import { Command } from '@nestjs/cqrs';
import { UserId } from '@module/user';

class CreditActiveErrandCommand extends Command<void> {
  constructor(
    public readonly workerUserId: UserId,
    public readonly escrowId: EscrowId,
    public readonly walletId: WalletId,
    public readonly amount: Money,
    public readonly gatewayReference: string,
    public readonly correlationId: string,
  ) {
    super();
  }
}

export { CreditActiveErrandCommand };
