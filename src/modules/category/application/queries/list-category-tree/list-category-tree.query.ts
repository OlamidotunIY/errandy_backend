import { Query } from '@nestjs/cqrs';
import { CategoryTreeNodeResponseDto, ListCategoryTreeRequestDto } from './list-category-tree.request.dto';

export class ListCategoryTreeQuery extends Query<
  CategoryTreeNodeResponseDto[]
> {
  constructor(public readonly payload: ListCategoryTreeRequestDto) {
    super();
  }
}
