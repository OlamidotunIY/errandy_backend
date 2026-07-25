import { DomainEvent, EntityId } from '@shared';
import { Escrow, EscrowId, Money } from '../';

export class EscrowReleasingEvent implements DomainEvent {
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
    this.eventName = 'EscrowReleasingEvent';
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowReleasingEvent {
    return new EscrowReleasingEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      workerId: escrow.workerId,
      amount: escrow.amountNetWorker,
    });
  }
}
