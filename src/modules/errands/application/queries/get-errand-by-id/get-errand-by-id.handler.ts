import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ErrandDetailResponseDto, GetErrandByIdQuery } from '.';
import { ErrandNotFoundError, IErrandRepository } from '@module/errands/domain';

@QueryHandler(GetErrandByIdQuery)
export class GetErrandByIdHandler implements IQueryHandler<GetErrandByIdQuery> {
  constructor(private readonly errandRepository: IErrandRepository) {}

  async execute(query: GetErrandByIdQuery): Promise<ErrandDetailResponseDto> {
    const errand = await this.errandRepository.findById(query.payload.errandId);

    if (!errand) {
      throw new ErrandNotFoundError(query.payload.errandId);
    }

    return {
      id: errand.id.value,
      clientId: errand.clientId,
      categoryId: errand.categoryId,
      title: errand.title,
      description: errand.description,
      addressId: errand.addressId,
      budget: {
        amountMinorUnits: errand.budget.amountMinorUnits,
        currency: errand.budget.currency,
      },
      status: errand.status,
      sourceType: errand.sourceType,
      requiredTier: errand.requiredTier,
      marketId: errand.marketId,
      startedAt: errand.startedAt?.toISOString(),
      completedAt: errand.completedAt?.toISOString(),
      createdAt: errand.createdAt.toISOString(),
    };
  }
}
