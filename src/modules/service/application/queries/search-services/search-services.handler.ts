import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SearchServicesQuery } from '.';
import { ServiceResponseDto } from '../get-service-by-id';
import {
  IServiceRepository,
  ServiceInvariantError,
} from '@module/service/domain';

@QueryHandler(SearchServicesQuery)
export class SearchServicesHandler implements IQueryHandler<SearchServicesQuery> {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(query: SearchServicesQuery): Promise<ServiceResponseDto[]> {
    const { categoryId, marketId, limit, cursor } = query.payload;

    if (!categoryId) {
      throw new ServiceInvariantError(
        'categoryId is required to search services in this market',
      );
    }

    const services = await this.serviceRepository.findActiveByCategory(
      categoryId,
      marketId,
    );

    const startIndex = cursor
      ? services.findIndex((service) => service.id.value === cursor) + 1
      : 0;

    return services.slice(startIndex, startIndex + limit).map((service) => ({
      id: service.id.value,
      listedById: service.listedById,
      categoryId: service.categoryId,
      title: service.title,
      description: service.description,
      price: {
        amountMinorUnits: service.price.amountMinorUnits,
        currency: service.price.currency,
      },
    }));
  }
}
