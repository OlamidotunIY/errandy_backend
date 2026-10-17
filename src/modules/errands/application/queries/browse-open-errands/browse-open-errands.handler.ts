import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BrowseOpenErrandsQuery } from './browse-open-errands.query';
import { BrowseOpenErrandsResponseDto } from './browse-open-errands.request.dto';
import { IErrandRepository } from '@module/errands/domain';
import { IPartyReadPort, ReferenceNotFoundError } from '@src/common';

@QueryHandler(BrowseOpenErrandsQuery)
export class BrowseOpenErrandsHandler implements IQueryHandler<BrowseOpenErrandsQuery> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyReadPort: IPartyReadPort,
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
      await this.partyReadPort.findById(requesterPartyId);
    if (!requesterParty) {
      throw new ReferenceNotFoundError('Party', requesterPartyId);
    }

    const errands = await this.errandRepository.findOpenErrands({
      marketId: requesterParty.marketId,
      categoryId,
      requesterTier: requesterParty.providerTier ?? 'COMMUNITY',
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
