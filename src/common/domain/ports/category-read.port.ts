import { ProviderTierName } from './party-read.port';

export interface CategorySnapshot {
  id: string;
  isLeaf: boolean;
  requiredTier: ProviderTierName | null;
}

const TIER_RANK: Record<ProviderTierName, number> = {
  COMMUNITY: 0,
  VERIFIED: 1,
  CERTIFIED: 2,
};

/** True when a provider of `tier` may operate in a category requiring `requiredTier`. */
export function meetsRequiredTier(
  requiredTier: ProviderTierName | null,
  tier: ProviderTierName,
): boolean {
  if (!requiredTier) {
    return true;
  }
  return TIER_RANK[tier] >= TIER_RANK[requiredTier];
}

/**
 * Read-only query port owned by the Category module (adapter lives there).
 */
export abstract class ICategoryReadPort {
  abstract findById(categoryId: string): Promise<CategorySnapshot | null>;
}
