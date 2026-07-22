import { Escrow } from '../';

class EscrowDisputedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: string,
    public readonly occurredAt: Date,
  ) {
    this.eventName = 'EscrowDisputedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(escrow: Escrow): EscrowDisputedEvent {
    return new EscrowDisputedEvent(escrow.id, escrow.errandId, new Date());
  }
}
