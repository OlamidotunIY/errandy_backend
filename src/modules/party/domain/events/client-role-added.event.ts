import { BaseDomainEvent } from '@src/common';
import { Party } from '../entities';
import { PartyId } from '../value-objects';

interface ClientRoleAddedPayload {
  partyId: string;
}

export class ClientRoleAddedEvent extends BaseDomainEvent<
  PartyId,
  ClientRoleAddedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: ClientRoleAddedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: ClientRoleAddedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    party: Party,
    correlationId?: string,
  ): ClientRoleAddedEvent {
    return new ClientRoleAddedEvent(party.id, correlationId, {
      partyId: party.id.value,
    });
  }
}
