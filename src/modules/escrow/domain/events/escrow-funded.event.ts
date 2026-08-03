import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { Escrow, EscrowId } from '..';

export class EscrowFundedEvent extends BaseDomainEvent<EscrowId> {
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
      eventName: EscrowFundedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    escrow: Escrow,
    correlationId: string,
  ): EscrowFundedEvent {
    return new EscrowFundedEvent(escrow.id, new Date(), correlationId, {
      errandId: escrow.errandId,
      clientPartyId: escrow.clientPartyId,
      providerPartyId: escrow.providerPartyId,
      amountGross: escrow.amountGross,
    });
  }
}
