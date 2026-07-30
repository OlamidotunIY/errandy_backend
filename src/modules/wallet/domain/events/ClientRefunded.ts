import { UserId } from '@user';
import { WalletId } from '../value-objects';
import { EscrowId } from 'src/modules/escrow';
import { DomainEvent } from '@shared';
import { Wallet } from 'src/modules/wallet/domain';

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
