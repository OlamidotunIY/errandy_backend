import { WalletId } from '../value-objects';
import { Wallet } from '../entities';
import { BaseDomainEvent } from '@src/common';
import { UserId } from '@module/user';

interface WithdrawalRecordedPayload {
  walletId: WalletId;
  userId: UserId;
  gatewayReference: string;
}

class WithdrawalRecorded extends BaseDomainEvent<
  WalletId,
  WithdrawalRecordedPayload
> {
  constructor(
    walletId: WalletId,
    userId: UserId,
    gatewayReference: string,
    correlationId: string,
  ) {
    super({
      aggregateId: walletId,
      correlationId,
      eventName: WithdrawalRecorded.name,
      payload: { walletId, userId, gatewayReference },
    });
  }

  static fromAggregate(
    wallet: Wallet,
    gatewayReference: string,
    correlationId: string,
  ): WithdrawalRecorded {
    return new WithdrawalRecorded(
      wallet.id,
      wallet.userId,
      gatewayReference,
      correlationId,
    );
  }
}

export { WithdrawalRecorded };
