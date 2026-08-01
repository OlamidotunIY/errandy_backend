import { WalletId } from '../value-objects';
import { EscrowId } from '@module/escrow';
import { Wallet } from '../entities';
import { BaseDomainEvent } from '@src/common';
import { UserId } from '@module/user';

interface ClientRefundedPayload {
  walletId: WalletId;
  userId: UserId;
  escrowId: EscrowId;
  gatewayReference: string;
}

class ClientRefunded extends BaseDomainEvent<WalletId, ClientRefundedPayload> {
  constructor(
    walletId: WalletId,
    userId: UserId,
    escrowId: EscrowId,
    gatewayReference: string,
    correlationId: string,
  ) {
    super({
      aggregateId: walletId,
      correlationId,
      eventName: ClientRefunded.name,
      payload: { walletId, userId, escrowId, gatewayReference },
    });
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
