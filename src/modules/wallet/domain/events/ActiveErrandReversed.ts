import { BaseDomainEvent } from '@src/common';
import { WalletId } from '../value-objects';
import { UserId } from '@module/user';
import { EscrowId } from '@module/escrow';
import { Wallet } from '../entities';

interface ActiveErrandReversedPayload {
  walletId: WalletId;
  userId: UserId;
  escrowId: EscrowId;
}

class ActiveErrandReversed extends BaseDomainEvent<
  WalletId,
  ActiveErrandReversedPayload
> {
  constructor(
    walletId: WalletId,
    userId: UserId,
    escrowId: EscrowId,
    correlationId: string,
  ) {
    super({
      aggregateId: walletId,
      correlationId,
      eventName: ActiveErrandReversed.name,
      payload: { walletId, userId, escrowId },
    });
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    correlationId: string,
  ): ActiveErrandReversed {
    return new ActiveErrandReversed(
      wallet.id,
      wallet.userId,
      escrowId,
      correlationId,
    );
  }
}

export { ActiveErrandReversed };
