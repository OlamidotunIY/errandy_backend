import { UserId } from '@user';
import { WalletId } from '../value-objects';
import { DomainEvent } from '@shared';

class WithdrawalRecorded implements DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly amountKobo: number,
    public readonly gatewayReference: string,
  ) {
    this.eventName = WithdrawalRecorded.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }
  get aggregateId(): WalletId {
    return this.walletId;
  }
}

export { WithdrawalRecorded };
