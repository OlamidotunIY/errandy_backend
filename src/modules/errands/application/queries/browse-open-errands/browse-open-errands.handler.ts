import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BrowseOpenErrandsQuery, BrowseOpenErrandsResponseDto } from '.';
import { IErrandRepository } from '@module/errands/domain';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderTier,
} from '@module/party';

@QueryHandler(BrowseOpenErrandsQuery)
export class BrowseOpenErrandsHandler implements IQueryHandler<BrowseOpenErrandsQuery> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
  ) {}

  async execute(
    query: BrowseOpenErrandsQuery,
  ): Promise<BrowseOpenErrandsResponseDto> {
    const {
      requesterPartyId,
      categoryId,
      latitude,
      longitude,
      radiusMeters,
      limit,
    } = query.payload;

    const requesterParty =
      await this.partyRepository.findById(requesterPartyId);
    if (!requesterParty) {
      throw new PartyNotFoundError(requesterPartyId);
    }

    const errands = await this.errandRepository.findOpenErrands({
      marketId: requesterParty.marketId,
      categoryId,
      requesterTier:
        requesterParty.providerRole?.tier ?? ProviderTier.COMMUNITY,
      latitude,
      longitude,
      radiusMeters,
      limit,
    });

    return {
      items: errands.map((errand) => {
        return {
          id: errand.id.value,
          title: errand.title,
          categoryId: errand.categoryId,
          budget: {
            amountMinorUnits: errand.budget.amountMinorUnits,
            currency: errand.budget.currency,
          },
          distanceMeters: errand.distanceInMetersFrom(latitude, longitude) ?? 0,
          createdAt: errand.createdAt.toISOString(),
        };
      }),
    };
  }
}
