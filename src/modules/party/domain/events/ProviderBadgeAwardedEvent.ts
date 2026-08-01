import { BaseDomainEvent } from '@src/common';
import { PartyId } from '../value-objects';
import { BadgeType } from '../value-objects';

interface ProviderBadgeAwardedPayload {
  partyId: string;
  badgeType: BadgeType;
  awardedByOrganizationId: string;
  period: string;
}

export class ProviderBadgeAwardedEvent extends BaseDomainEvent<
  PartyId,
  ProviderBadgeAwardedPayload
> {
  constructor(
    aggregateId: PartyId,
    correlationId: string | undefined,
    payload: ProviderBadgeAwardedPayload,
  ) {
    super({
      aggregateId,
      correlationId,
      eventName: ProviderBadgeAwardedEvent.name,
      payload,
    });
  }

  static create(
    partyId: PartyId,
    payload: ProviderBadgeAwardedPayload,
    correlationId?: string,
  ): ProviderBadgeAwardedEvent {
    return new ProviderBadgeAwardedEvent(partyId, correlationId, payload);
  }
}
