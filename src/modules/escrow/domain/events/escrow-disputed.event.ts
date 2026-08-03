import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Escrow, EscrowId } from '..';

export class EscrowDisputedEvent extends BaseDomainEvent<EscrowId> {
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
      eventName: EscrowDisputedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowDisputedEvent {
    return new EscrowDisputedEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      clientPartyId: escrow.clientPartyId,
      amount: escrow.amountGross,
    });
  }
}
