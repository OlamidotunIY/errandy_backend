import { AggregateRoot } from '@src/common';
import { BadgeType, PartyId, ProviderBadgeId } from '../';
import { ProviderBadgeAwardedEvent } from '../events';

export class ProviderBadge extends AggregateRoot<ProviderBadgeId> {
  constructor(
    public readonly id: ProviderBadgeId,
    public readonly partyId: PartyId,
    private _badgeType: BadgeType,
    public readonly awardedByOrganizationId: PartyId,
    private _period: string,
    private _awardedAt: Date,
  ) {
    super(id);
  }

  static award(params: {
    partyId: PartyId;
    badgeType: BadgeType;
    awardedByOrganizationId: PartyId;
    period: string;
    correlationId?: string;
  }): ProviderBadge {
    const badge = new ProviderBadge(
      ProviderBadgeId.create(),
      params.partyId,
      params.badgeType,
      params.awardedByOrganizationId,
      params.period,
      new Date(),
    );

    badge.addDomainEvent(
      ProviderBadgeAwardedEvent.create(
        params.partyId,
        {
          partyId: params.partyId.value,
          badgeType: params.badgeType,
          awardedByOrganizationId: params.awardedByOrganizationId.value,
          period: params.period,
        },
        params.correlationId,
      ),
    );

    return badge;
  }

  get badgeType(): BadgeType {
    return this._badgeType;
  }

  get period(): string {
    return this._period;
  }

  get awardedAt(): Date {
    return this._awardedAt;
  }
}
