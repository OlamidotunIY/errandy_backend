import { DomainEvent } from '@src/common';
import { Escrow, EscrowId, RefundReason } from '..';

export class EscrowRefundingEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly escrowId: EscrowId,
    occurredAt: Date,
    correlationId: string,
    public readonly payload: Record<string, unknown>,
  ) {
    this.eventName = 'EscrowRefundingEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.correlationId = correlationId;
    this.eventId = crypto.randomUUID();
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
