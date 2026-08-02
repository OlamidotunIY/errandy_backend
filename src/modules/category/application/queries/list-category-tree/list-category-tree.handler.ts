import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CategoryTreeNodeResponseDto, ListCategoryTreeQuery } from '.';
import { Category, ICategoryRepository } from '@module/category/domain';

@QueryHandler(ListCategoryTreeQuery)
export class ListCategoryTreeHandler implements IQueryHandler<ListCategoryTreeQuery> {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(
    query: ListCategoryTreeQuery,
  ): Promise<CategoryTreeNodeResponseDto[]> {
    const roots = query.payload.rootId
      ? await this.categoryRepository.findChildren(query.payload.rootId)
      : await this.categoryRepository.findRoots();

    return Promise.all(roots.map((root) => this.toTreeNode(root)));
  }

  private async toTreeNode(
    category: Category,
  ): Promise<CategoryTreeNodeResponseDto> {
    const children = await this.categoryRepository.findChildren(
      category.id.value,
    );

    return {
      id: category.id.value,
      name: category.name,
      requiredTier: category.requiredTier,
      children: await Promise.all(
        children.map((child) => this.toTreeNode(child)),
      ),
    };
  }
}
