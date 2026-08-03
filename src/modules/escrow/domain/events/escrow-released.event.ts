import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Escrow, EscrowId } from '..';

export class EscrowReleasedEvent extends BaseDomainEvent<EscrowId> {
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
      eventName: EscrowReleasedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowReleasedEvent {
    return new EscrowReleasedEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      providerPartyId: escrow.providerPartyId,
      amount: escrow.amountNetWorker,
      releasedAt: escrow.releasedAt!,
    });
  }
}
