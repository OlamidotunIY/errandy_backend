export type ProviderTierName = 'COMMUNITY' | 'VERIFIED' | 'CERTIFIED';

export interface PartySnapshot {
  id: string;
  marketId: string;
  kind: 'PERSON' | 'ORGANIZATION';
  /** User behind a PERSON party, otherwise null. */
  personUserId: string | null;
  /** Owner user of an ORGANIZATION party, otherwise null. */
  organizationOwnerUserId: string | null;
  /** Tier of the provider role, or null when the party has no provider role. */
  providerTier: ProviderTierName | null;
}

/**
 * Read-only query port owned by the Party module (adapter lives there).
 * Any module may inject it without importing PartyModule.
 */
export abstract class IPartyReadPort {
  abstract findById(partyId: string): Promise<PartySnapshot | null>;
  abstract findPartyIdByUserId(userId: string): Promise<string | null>;
}
