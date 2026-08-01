import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  SearchProvidersByServiceQuery,
  SearchProvidersByServiceResponseDto,
} from '.';
import { IPartyRepository, PartyInvariantError } from '@module/party';

@QueryHandler(SearchProvidersByServiceQuery)
export class SearchProvidersByServiceHandler implements IQueryHandler<SearchProvidersByServiceQuery> {
  constructor(private readonly partyRepository: IPartyRepository) {}

  async execute(
    query: SearchProvidersByServiceQuery,
  ): Promise<SearchProvidersByServiceResponseDto> {
    const { service, limit } = query.payload;

    if (!service) {
      throw new PartyInvariantError('service is required');
    }

    const parties = await this.partyRepository.searchProvidersBySkill(
      service,
      limit,
    );

    return {
      providers: parties
        .filter((party) => Boolean(party.providerRole))
        .map((party) => ({
          partyId: party.id.value,
          tier: party.providerRole!.tier,
          skills: party.providerRole!.skills,
          bio: party.providerRole!.bio ?? null,
          trustedByCount: party.providerRole!.trustedByCount,
          avgRatingCached: party.providerRole!.avgRatingCached ?? null,
          completedErrandsCount: party.providerRole!.completedErrandsCount,
        })),
    };
  }
}
