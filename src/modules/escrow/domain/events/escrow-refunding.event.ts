import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Escrow, EscrowId, RefundReason } from '..';

export class EscrowRefundingEvent extends BaseDomainEvent<EscrowId> {
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
      eventName: EscrowRefundingEvent.name,
      payload,
    });
  }

  static fromAggregate(
    escrow: Escrow,
    reason: RefundReason,
    correlationId: string,
  ): EscrowRefundingEvent {
    return new EscrowRefundingEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      clientId: escrow.clientId,
      amount: escrow.amountGross,
      reason: reason,
    });
  }
}
