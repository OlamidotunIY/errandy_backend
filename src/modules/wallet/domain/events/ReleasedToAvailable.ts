import { WalletId } from '../value-objects';
import { Wallet } from '../entities';
import { DomainEvent } from '@src/common';
import { UserId } from '@module/user';
import { EscrowId } from '@module/escrow';

class ReleasedToAvailable implements DomainEvent {
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
    this.eventName = ReleasedToAvailable.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
    this.aggregateId = walletId;
    this.correlationId = correlationId;
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
