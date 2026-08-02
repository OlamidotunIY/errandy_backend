import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  GetOrgFacingProviderProfileQuery,
  GetOrgFacingProviderProfileResponseDto,
} from '.';
import {
  IPartyRepository,
  IProviderBadgeRepository,
  OrganizationNotFoundError,
  PartyInvariantError,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';

@QueryHandler(GetOrgFacingProviderProfileQuery)
export class GetOrgFacingProviderProfileHandler implements IQueryHandler<GetOrgFacingProviderProfileQuery> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly providerBadgeRepository: IProviderBadgeRepository,
  ) {}

  async execute(
    query: GetOrgFacingProviderProfileQuery,
  ): Promise<GetOrgFacingProviderProfileResponseDto> {
    const { partyId, requestingOrganizationId } = query.payload;

    if (!partyId || !requestingOrganizationId) {
      throw new PartyInvariantError(
        'partyId and requestingOrganizationId are required',
      );
    }

    const requester = await this.partyRepository.findById(
      requestingOrganizationId,
    );
    if (!requester?.organization) {
      throw new OrganizationNotFoundError(requestingOrganizationId);
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    const badges = await this.providerBadgeRepository.findByPartyId(partyId);

    return {
      partyId,
      bio: party.providerRole.bio ?? null,
      skills: party.providerRole.skills,
      tier: party.providerRole.tier,
      trustedByCount: party.providerRole.trustedByCount,
      avgRatingCached: party.providerRole.avgRatingCached ?? null,
      completedErrandsCount: party.providerRole.completedErrandsCount,
      disputedErrandsCount: party.providerRole.disputedErrandsCount,
      avgResponseTimeSeconds: party.providerRole.avgResponseTimeSeconds ?? null,
      badges: badges.map((badge) => ({
        badgeType: badge.badgeType,
        awardedByOrganizationId: badge.awardedByOrganizationId.value,
        period: badge.period,
        awardedAt: badge.awardedAt,
      })),
    };
  }
}
