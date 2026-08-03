import { Query } from '@nestjs/cqrs';
import { CategoryTreeNodeResponseDto, ListCategoryTreeRequestDto } from '.';

export class ListCategoryTreeQuery extends Query<
  CategoryTreeNodeResponseDto[]
> {
  constructor(public readonly payload: ListCategoryTreeRequestDto) {
    super();
  }
}
