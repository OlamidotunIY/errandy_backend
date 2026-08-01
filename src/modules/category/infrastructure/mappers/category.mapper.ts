import { Injectable } from '@nestjs/common';
import { Category as PrismaCategory } from '@prisma/client';
import { ProviderTier } from '@module/party';
import { Category, CategoryId } from '../../domain';

@Injectable()
export class CategoryMapper {
  toDomain(record: PrismaCategory, childrenIds: string[] = []): Category {
    return Category.reconstitute({
      id: CategoryId.fromString(record.id),
      name: record.name,
      parentCategoryId: record.parentCategoryId
        ? CategoryId.fromString(record.parentCategoryId)
        : null,
      childrenIds: childrenIds.map((id) => CategoryId.fromString(id)),
      requiredTier: record.requiredTier
        ? (record.requiredTier as ProviderTier)
        : null,
    });
  }
}
