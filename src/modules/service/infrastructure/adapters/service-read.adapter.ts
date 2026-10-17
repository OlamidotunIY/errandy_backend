import { Injectable } from '@nestjs/common';
import { IServiceReadPort, ServiceSnapshot } from '@src/common';
import { IServiceRepository } from '../../domain';

@Injectable()
export class ServiceReadAdapter extends IServiceReadPort {
  constructor(private readonly serviceRepository: IServiceRepository) {
    super();
  }

  async findById(serviceId: string): Promise<ServiceSnapshot | null> {
    const service = await this.serviceRepository.findById(serviceId);
    if (!service) {
      return null;
    }

    return {
      id: service.id.value,
      listedById: service.listedById,
      categoryId: service.categoryId,
      title: service.title,
      description: service.description,
      priceMinorUnits: service.price.amountMinorUnits,
      currency: service.price.currency,
      isActive: service.isActive,
    };
  }
}
