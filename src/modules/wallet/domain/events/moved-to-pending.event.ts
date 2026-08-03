import { WalletId } from '../value-objects';
import { EscrowId } from 'src/modules/escrow';
import { Wallet } from '../entities';
import { BaseDomainEvent } from '@src/common';
import { UserId } from '@module/user';

interface MovedToPendingPayload {
  walletId: WalletId;
  userId: UserId;
  escrowId: EscrowId;
}

class MovedToPending extends BaseDomainEvent<WalletId, MovedToPendingPayload> {
  constructor(
    walletId: WalletId,
    userId: UserId,
    escrowId: EscrowId,
    correlationId: string,
  ) {
    super({
      aggregateId: walletId,
      correlationId,
      eventName: MovedToPending.name,
      payload: { walletId, userId, escrowId },
    });
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    correlationId: string,
  ): MovedToPending {
    return new MovedToPending(
      wallet.id,
      wallet.userId,
      escrowId,
      correlationId,
    );
  }
}

export { MovedToPending };
