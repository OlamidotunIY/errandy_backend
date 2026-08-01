import { AggregateRoot } from '@src/common';
import { BadgeType, PartyId, ProviderBadgeId } from '../';

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
