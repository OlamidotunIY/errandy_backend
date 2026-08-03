import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Escrow, EscrowId } from '..';

export class EscrowReleasingEvent extends BaseDomainEvent<EscrowId> {
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
      eventName: EscrowReleasingEvent.name,
      payload,
    });
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowReleasingEvent {
    return new EscrowReleasingEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      providerPartyId: escrow.providerPartyId,
      amount: escrow.amountNetWorker,
    });
  }
}
