import { UserId } from '@user';
import { WalletId } from '../value-objects';
import { EscrowId } from '@escrow';
import { DomainEvent } from '@shared';
class MovedToPending implements DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  ) {
    this.eventName = MovedToPending.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }

  get aggregateId(): WalletId {
    return this.walletId;
  }
}

export { MovedToPending };
