import { Args, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import {
  ListCategoryTreeQuery,
  CategoryTreeNodeResponseDto,
} from '../../application';
import { CategoryTreeNodeType } from '../graphql';

@Resolver()
export class CategoryResolver {
  constructor(private readonly queryBus: QueryBus) {}

  @Query(() => [CategoryTreeNodeType], {
    name: 'categoryTree',
    description: 'Get hierarchical category tree',
  })
  async categoryTree(
    @Args('rootId', { type: () => String, nullable: true }) rootId?: string,
  ): Promise<CategoryTreeNodeResponseDto[]> {
    return this.queryBus.execute(new ListCategoryTreeQuery({ rootId }));
  }
}
