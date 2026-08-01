import { BaseDomainEvent } from '@src/common';
import { Party } from '../entities';
import { PartyId } from '../value-objects';

interface PartyDeactivatedPayload {
  partyId: string;
}

export class PartyDeactivatedEvent extends BaseDomainEvent<
  PartyId,
  PartyDeactivatedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: PartyDeactivatedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: PartyDeactivatedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    party: Party,
    correlationId?: string,
  ): PartyDeactivatedEvent {
    return new PartyDeactivatedEvent(party.id, correlationId, {
      partyId: party.id.value,
    });
  }
}
