import { BaseDomainEvent } from '@src/common';
import { Party } from '../entities';
import { PartyId } from '../value-objects';

interface ProviderRoleAddedPayload {
  partyId: string;
}

export class ProviderRoleAddedEvent extends BaseDomainEvent<
  PartyId,
  ProviderRoleAddedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: ProviderRoleAddedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: ProviderRoleAddedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    party: Party,
    correlationId?: string,
  ): ProviderRoleAddedEvent {
    return new ProviderRoleAddedEvent(party.id, correlationId, {
      partyId: party.id.value,
    });
  }
}
