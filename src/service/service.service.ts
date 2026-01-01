import { Injectable } from '@nestjs/common';
import { GetServiceCategoriesInput } from './dto/get-service-categories.input';
import { PrismaService } from 'src/prisma.service';
import { GqlServiceCategoryType } from './entities/enums';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  findOne(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async getServiceCategories(input?: GetServiceCategoriesInput) {
    const where = input?.type ? { type: input.type } : {};

    const serviceCategory = await this.prisma.serviceCategory.findMany({
      where,
      include: {
        services: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return serviceCategory;
  }

  async getServices(categoryType?: GqlServiceCategoryType) {
    const where = categoryType ? { type: categoryType } : {};

    return this.prisma.service.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
