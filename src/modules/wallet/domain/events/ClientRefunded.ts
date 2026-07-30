import { WalletId } from '../value-objects';
import { EscrowId } from '@module/escrow';
import { Wallet } from '../entities';
import { DomainEvent } from '@src/common';
import { UserId } from '@src/users';

class ClientRefunded implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: WalletId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly gatewayReference: string,
    correlationId: string,
  ) {
    this.eventName = ClientRefunded.name;
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
    this.aggregateId = walletId;
    this.correlationId = correlationId;
  }

  static fromAggregate(
    wallet: Wallet,
    escrowId: EscrowId,
    gatewayReference: string,
    correlationId: string,
  ): ClientRefunded {
    return new ClientRefunded(
      wallet.id,
      wallet.userId,
      escrowId,
      gatewayReference,
      correlationId,
    );
  }
}

export { ClientRefunded };
