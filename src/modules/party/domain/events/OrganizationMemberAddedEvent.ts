import { BaseDomainEvent } from '@src/common';
import { PartyId } from '../value-objects';

interface OrganizationMemberAddedPayload {
  organizationId: string;
  userId: string;
}

export class OrganizationMemberAddedEvent extends BaseDomainEvent<
  PartyId,
  OrganizationMemberAddedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: OrganizationMemberAddedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: OrganizationMemberAddedEvent.name,
      payload,
    });
  }

  static create(
    partyId: PartyId,
    userId: string,
    correlationId?: string,
  ): OrganizationMemberAddedEvent {
    return new OrganizationMemberAddedEvent(partyId, correlationId, {
      organizationId: partyId.value,
      userId,
    });
  }
}
