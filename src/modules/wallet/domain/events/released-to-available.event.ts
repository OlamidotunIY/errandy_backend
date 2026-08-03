import { WalletId } from '../value-objects';
import { Wallet } from '../entities';
import { BaseDomainEvent } from '@src/common';
import { UserId } from '@module/user';
import { EscrowId } from '@module/escrow';

interface ReleasedToAvailablePayload {
  walletId: WalletId;
  userId: UserId;
  escrowId: EscrowId;
}

class ReleasedToAvailable extends BaseDomainEvent<
  WalletId,
  ReleasedToAvailablePayload
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
      eventName: ReleasedToAvailable.name,
      payload: { walletId, userId, escrowId },
    });
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    correlationId: string,
  ): ReleasedToAvailable {
    return new ReleasedToAvailable(
      wallet.id,
      wallet.userId,
      escrowId,
      correlationId,
    );
  }
}

export { ReleasedToAvailable };
