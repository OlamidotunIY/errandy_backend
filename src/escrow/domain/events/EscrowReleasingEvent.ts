import { DomainEvent, EntityId } from '@shared';
import { Escrow, EscrowId, Money } from '../';

class EscrowReleasingEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: string,
    public readonly workerId: string,
    public readonly amount: Money,
    public readonly occurredAt: Date,
  ) {
    this.eventName = 'EscrowReleasingEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(escrow: Escrow): EscrowReleasingEvent {
    return new EscrowReleasingEvent(
      escrow.id,
      escrow.errandId,
      escrow.workerId,
      escrow.amountNetWorker,
      new Date(),
    );
  }
}
