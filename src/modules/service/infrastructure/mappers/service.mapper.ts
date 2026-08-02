import { Injectable } from '@nestjs/common';
import { Service as PrismaService_ } from '@prisma/client';
import { Currency, Money } from '@module/escrow/domain';
import { Service, ServiceId } from '../../domain';

@Injectable()
export class ServiceMapper {
  toDomain(record: PrismaService_): Service {
    return Service.reconstitute({
      id: ServiceId.fromString(record.id),
      listedById: record.listedById,
      categoryId: record.categoryId,
      marketId: record.marketId,
      title: record.title,
      description: record.description,
      price: Money.fromMinorUnits(
        record.priceAmountMinorUnits,
        record.priceCurrency as Currency,
      ),
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  toPersistence(service: Service): {
    id: string;
    listedById: string;
    categoryId: string;
    marketId: string;
    title: string;
    description: string;
    priceAmountMinorUnits: number;
    priceCurrency: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: service.id.value,
      listedById: service.listedById,
      categoryId: service.categoryId,
      marketId: service.marketId,
      title: service.title,
      description: service.description,
      priceAmountMinorUnits: service.price.amountMinorUnits,
      priceCurrency: service.price.currency,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
