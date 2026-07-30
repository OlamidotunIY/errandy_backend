import { DomainEvent } from '@src/common';
import { Escrow, EscrowId } from '..';

export class EscrowFundedEvent implements DomainEvent {
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
    this.eventName = 'EscrowFundedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.correlationId = correlationId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowFundedEvent {
    return new EscrowFundedEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      clientId: escrow.clientId,
      workerId: escrow.workerId,
      amountGross: escrow.amountGross,
    });
  }
}
