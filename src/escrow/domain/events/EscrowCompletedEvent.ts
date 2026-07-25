import { DomainEvent } from '@shared';
import { Escrow, EscrowId } from '@escrow/domain';

export class EscrowCompletedEvent implements DomainEvent {
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
    this.eventName = 'EscrowCompletedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
    this.correlationId = correlationId;
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowCompletedEvent {
    return new EscrowCompletedEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      clientId: escrow.clientId,
      amount: escrow.amountGross,
    });
  }
}
