import { WalletId } from '../value-objects';
import { Wallet } from '../entities';
import { DomainEvent } from '@src/common';
import { UserId } from '@src/users';

class WithdrawalRecorded implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: WalletId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly gatewayReference: string,
    correlationId: string,
  ) {
    this.eventName = WithdrawalRecorded.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
    this.aggregateId = walletId;
    this.correlationId = correlationId;
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
