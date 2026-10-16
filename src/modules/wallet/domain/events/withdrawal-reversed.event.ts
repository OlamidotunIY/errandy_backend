import { WalletId } from '../value-objects';
import { Wallet } from '../entities';
import { BaseDomainEvent } from '@src/common';
import { UserId } from '@module/user';

export interface WithdrawalReversedPayload {
  walletId: WalletId;
  userId: UserId;
  gatewayReference: string;
  reason: string;
}

export class WithdrawalReversed extends BaseDomainEvent<
  WalletId,
  WithdrawalReversedPayload
> {
  constructor(
    walletId: WalletId,
    userId: UserId,
    gatewayReference: string,
    reason: string,
    correlationId: string,
  ) {
    super({
      aggregateId: walletId,
      correlationId,
      eventName: WithdrawalReversed.name,
      payload: { walletId, userId, gatewayReference, reason },
    });
  }

  static fromAggregate(
    wallet: Wallet,
    gatewayReference: string,
    reason: string,
    correlationId: string,
  ): WithdrawalReversed {
    return new WithdrawalReversed(
      wallet.id,
      wallet.userId,
      gatewayReference,
      reason,
      correlationId,
    );
  }
}
