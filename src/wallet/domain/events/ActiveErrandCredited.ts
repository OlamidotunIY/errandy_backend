import { UserId } from '@user';
import { EscrowId } from '@escrow';
import { DomainEvent } from '@shared';
import { WalletId } from '@wallet';

class ActiveErrandCredited implements DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  ) {
    this.eventName = ActiveErrandCredited.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }

  get aggregateId(): WalletId {
    return this.walletId;
  }
}

export { ActiveErrandCredited };
