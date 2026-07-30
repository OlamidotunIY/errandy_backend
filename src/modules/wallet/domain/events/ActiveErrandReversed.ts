import { DomainEvent } from '@src/common';
import { WalletId } from '../value-objects';
import { UserId } from '@src/users';
import { EscrowId } from '@module/escrow';
import { Wallet } from '../entities';

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
