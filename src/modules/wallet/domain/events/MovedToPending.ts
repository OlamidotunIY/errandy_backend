import { WalletId } from '../value-objects';
import { EscrowId } from 'src/modules/escrow';
import { Wallet } from '../entities';
import { DomainEvent } from '@src/common';
import { UserId } from '@module/user';

class MovedToPending implements DomainEvent {
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
    this.eventName = MovedToPending.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
    this.correlationId = correlationId;
    this.aggregateId = walletId;
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    correlationId: string,
  ): MovedToPending {
    return new MovedToPending(
      wallet.id,
      wallet.userId,
      escrowId,
      correlationId,
    );
  }
}

export { MovedToPending };
