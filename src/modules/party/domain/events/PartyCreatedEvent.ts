import { BaseDomainEvent } from '@src/common';
import { Party } from '../entities';
import { PartyId, PartyKind } from '../value-objects';

interface PartyCreatedPayload {
  partyId: string;
  kind: PartyKind;
  marketId: string;
}

export class PartyCreatedEvent extends BaseDomainEvent<
  PartyId,
  PartyCreatedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: PartyCreatedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: PartyCreatedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    party: Party,
    correlationId?: string,
  ): PartyCreatedEvent {
    return new PartyCreatedEvent(party.id, correlationId, {
      partyId: party.id.value,
      kind: party.kind,
      marketId: party.marketId,
    });
  }
}
