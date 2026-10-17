import { ProviderBadge } from '../entities';

export abstract class IProviderBadgeRepository {
  abstract save(badge: ProviderBadge): Promise<void>;
  abstract findByPartyId(partyId: string): Promise<ProviderBadge[]>;
}
