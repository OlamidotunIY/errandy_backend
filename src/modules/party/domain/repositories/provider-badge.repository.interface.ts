import { ProviderBadge } from '@module/party';

export abstract class IProviderBadgeRepository {
  abstract save(badge: ProviderBadge): Promise<void>;
}
