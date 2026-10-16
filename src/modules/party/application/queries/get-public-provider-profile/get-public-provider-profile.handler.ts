import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPublicProviderProfileQuery } from './get-public-provider-profile.query';
import { GetPublicProviderProfileResponseDto } from './get-public-provider-profile.request.dto';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '../../../domain';

@QueryHandler(GetPublicProviderProfileQuery)
export class GetPublicProviderProfileHandler implements IQueryHandler<GetPublicProviderProfileQuery> {
  constructor(private readonly partyRepository: IPartyRepository) {}

  async execute(
    query: GetPublicProviderProfileQuery,
  ): Promise<GetPublicProviderProfileResponseDto> {
    const { partyId } = query.payload;

    if (!partyId) {
      throw new PartyInvariantError('partyId is required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    return {
      partyId,
      bio: party.providerRole.bio ?? null,
      skills: party.providerRole.skills,
      tier: party.providerRole.tier,
      trustedByCount: party.providerRole.trustedByCount,
      avgRatingCached: party.providerRole.avgRatingCached ?? null,
      completedErrandsCount: party.providerRole.completedErrandsCount,
    };
  }
}
