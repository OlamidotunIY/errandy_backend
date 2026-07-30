import { EscrowId } from 'src/modules/escrow';
import { Wallet, WalletId } from '@module/wallet';
import { DomainEvent } from '@src/common';
import { UserId } from '@src/users';

class ActiveErrandCredited implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: WalletId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    occurredAt: Date,
    correlationId: string,
  ) {
    this.eventName = ActiveErrandCredited.name;
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = walletId;
    this.correlationId = correlationId;
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    correlationId: string,
  ): ActiveErrandCredited {
    return new ActiveErrandCredited(
      wallet.id,
      wallet.userId,
      escrowId,
      new Date(),
      correlationId,
    );
  }
}

export { ActiveErrandCredited };
