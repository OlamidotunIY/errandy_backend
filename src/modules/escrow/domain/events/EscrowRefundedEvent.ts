import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Escrow, EscrowId } from '..';

export class EscrowRefundedEvent extends BaseDomainEvent<EscrowId> {
  constructor(
    escrowId: EscrowId,
    occurredAt: Date,
    correlationId: string,
    payload: DomainEventPayload,
  ) {
    super({
      aggregateId: escrowId,
      occurredAt,
      correlationId,
      eventName: EscrowRefundedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowRefundedEvent {
    return new EscrowRefundedEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      clientId: escrow.clientId,
      amount: escrow.amountGross,
      refundedAt: escrow.refundedAt!,
    });
  }
}
