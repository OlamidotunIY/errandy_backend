import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IServiceRepository, Service } from '../../domain';
import { ServiceMapper } from '../mappers';

@Injectable()
export class ServiceRepository implements IServiceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ServiceMapper,
  ) {}

  async save(service: Service): Promise<void> {
    const data = this.mapper.toPersistence(service);

    await this.prisma.service.upsert({
      where: { id: service.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Service | null> {
    const record = await this.prisma.service.findUnique({ where: { id } });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByListerId(listedById: string): Promise<Service[]> {
    const records = await this.prisma.service.findMany({
      where: { listedById },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findActiveByCategory(
    categoryId: string,
    marketId: string,
  ): Promise<Service[]> {
    const records = await this.prisma.service.findMany({
      where: { categoryId, marketId, isActive: true },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }
}
