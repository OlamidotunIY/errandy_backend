import { DomainEvent, EntityId } from '@shared';
import { Escrow, EscrowId, Money } from '..';

export class EscrowRefundedEvent implements DomainEvent {
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
    this.eventName = 'EscrowRefundedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.correlationId = correlationId;
    this.eventId = crypto.randomUUID();
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
