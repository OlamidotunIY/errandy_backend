import { BaseDomainEvent } from '@src/common';
import { PartyId } from '../value-objects';

interface OrganizationMemberRemovedPayload {
  organizationId: string;
  userId: string;
}

export class OrganizationMemberRemovedEvent extends BaseDomainEvent<
  PartyId,
  OrganizationMemberRemovedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: OrganizationMemberRemovedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: OrganizationMemberRemovedEvent.name,
      payload,
    });
  }

  static create(
    partyId: PartyId,
    userId: string,
    correlationId?: string,
  ): OrganizationMemberRemovedEvent {
    return new OrganizationMemberRemovedEvent(partyId, correlationId, {
      organizationId: partyId.value,
      userId,
    });
  }
}
