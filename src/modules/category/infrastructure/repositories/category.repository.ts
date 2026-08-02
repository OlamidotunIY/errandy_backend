import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ICategoryRepository, Category } from '../../domain';
import { CategoryMapper } from '../mappers';

@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CategoryMapper,
  ) {}

  async save(): Promise<void> {
    throw new Error(
      'Category records are seed-managed and not written from the application layer',
    );
  }

  async findById(id: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id } });
    if (!record) return null;

    const children = await this.prisma.category.findMany({
      where: { parentCategoryId: id },
      select: { id: true },
    });

    return this.mapper.toDomain(
      record,
      children.map((child) => child.id),
    );
  }

  async findChildren(parentCategoryId: string): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      where: { parentCategoryId },
    });

    return Promise.all(
      records.map(async (record) => {
        const children = await this.prisma.category.findMany({
          where: { parentCategoryId: record.id },
          select: { id: true },
        });
        return this.mapper.toDomain(
          record,
          children.map((child) => child.id),
        );
      }),
    );
  }

  async findRoots(): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      where: { parentCategoryId: null },
    });

    return Promise.all(
      records.map(async (record) => {
        const children = await this.prisma.category.findMany({
          where: { parentCategoryId: record.id },
          select: { id: true },
        });
        return this.mapper.toDomain(
          record,
          children.map((child) => child.id),
        );
      }),
    );
  }

  async findLeaves(): Promise<Category[]> {
    const records = await this.prisma.category.findMany();

    const leaves: Category[] = [];
    for (const record of records) {
      const children = await this.prisma.category.findMany({
        where: { parentCategoryId: record.id },
        select: { id: true },
      });
      if (children.length === 0) {
        leaves.push(this.mapper.toDomain(record, []));
      }
    }
    return leaves;
  }
}
