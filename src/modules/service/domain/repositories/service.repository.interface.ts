import { Service } from '../entities';

export abstract class IServiceRepository {
  abstract save(service: Service): Promise<void>;
  abstract findById(id: string): Promise<Service | null>;
  abstract findByListerId(listedById: string): Promise<Service[]>;
  abstract findActiveByCategory(
    categoryId: string,
    marketId: string,
  ): Promise<Service[]>;
}
