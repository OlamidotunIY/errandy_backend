import { Injectable } from '@nestjs/common';
import {
  CategorySnapshot,
  ICategoryReadPort,
  ProviderTierName,
} from '@src/common';
import { ICategoryRepository } from '../../domain';

@Injectable()
export class CategoryReadAdapter extends ICategoryReadPort {
  constructor(private readonly categoryRepository: ICategoryRepository) {
    super();
  }

  async findById(categoryId: string): Promise<CategorySnapshot | null> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      return null;
    }

    return {
      id: categoryId,
      isLeaf: category.isLeaf(),
      requiredTier: (category.requiredTier as ProviderTierName | null) ?? null,
    };
  }
}
