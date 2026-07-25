import { UserId } from '@user';
import { WalletId } from '../';
import { EscrowId } from '@escrow';
import { DomainEvent } from '@shared';
import { Wallet } from '@wallet/domain';

class ActiveErrandReversed implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: WalletId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    correlationId: string,
  ) {
    this.eventName = ActiveErrandReversed.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
    this.aggregateId = walletId;
    this.correlationId = correlationId;
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
