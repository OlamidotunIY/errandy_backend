import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetServiceByIdQuery, ServiceResponseDto } from '.';
import {
  IServiceRepository,
  ServiceNotFoundError,
} from '@module/service/domain';

@QueryHandler(GetServiceByIdQuery)
export class GetServiceByIdHandler implements IQueryHandler<GetServiceByIdQuery> {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(query: GetServiceByIdQuery): Promise<ServiceResponseDto> {
    const service = await this.serviceRepository.findById(
      query.payload.serviceId,
    );
    if (!service) {
      throw new ServiceNotFoundError(query.payload.serviceId);
    }

    return {
      id: service.id.value,
      listedById: service.listedById,
      categoryId: service.categoryId,
      title: service.title,
      description: service.description,
      price: {
        amountMinorUnits: service.price.amountMinorUnits,
        currency: service.price.currency,
      },
    };
  }
}
