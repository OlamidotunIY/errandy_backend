import { UserId } from '@user';
import { WalletId } from '../value-objects';
import { EscrowId } from '@escrow';
import { DomainEvent } from '@shared';
import { Wallet } from '@wallet/domain';

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
