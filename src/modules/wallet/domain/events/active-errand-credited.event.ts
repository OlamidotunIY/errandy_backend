import { EscrowId } from '@module/escrow/domain';
import { WalletId } from '../value-objects';
import { Wallet } from '../entities';
import { BaseDomainEvent } from '@src/common';
import { UserId } from '@module/user/domain';

interface ActiveErrandCreditedPayload {
  walletId: WalletId;
  userId: UserId;
  escrowId: EscrowId;
}

class ActiveErrandCredited extends BaseDomainEvent<
  WalletId,
  ActiveErrandCreditedPayload
> {
  constructor(
    walletId: WalletId,
    userId: UserId,
    escrowId: EscrowId,
    occurredAt: Date,
    correlationId: string,
  ) {
    super({
      aggregateId: walletId,
      occurredAt,
      correlationId,
      eventName: ActiveErrandCredited.name,
      payload: { walletId, userId, escrowId },
    });
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    correlationId: string,
  ): ActiveErrandCredited {
    return new ActiveErrandCredited(
      wallet.id,
      wallet.userId,
      escrowId,
      new Date(),
      correlationId,
    );
  }
}

export { ActiveErrandCredited };
