import { OrganizationMember, Party } from '@module/party';

export abstract class IPartyRepository {
  abstract save(party: Party): Promise<void>; // persists Party + whichever of Person/Organization/ProviderRole are attached, as one unit
  abstract findById(id: string): Promise<Party | null>;
  abstract findByUserId(userId: string): Promise<Party | null>; // Person lookup
  abstract findByBusinessRegistrationNumber(
    businessRegistrationNumber: string,
  ): Promise<Party | null>;
  abstract findByOwnerId(userId: string): Promise<Party[]>; // Organizations a user owns
  abstract findOrganizationMembers(
    organizationPartyId: string,
  ): Promise<OrganizationMember[]>;
  abstract searchProvidersBySkill(
    skill: string,
    limit?: number,
  ): Promise<Party[]>;
}
