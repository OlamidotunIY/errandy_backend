import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  CategoryMapper,
  CategoryRepository,
  ICategoryRepository,
  ListCategoryTreeHandler,
} from '@module/category';

@Module({
  imports: [CqrsModule],
  providers: [
    CategoryMapper,
    {
      provide: ICategoryRepository,
      useClass: CategoryRepository,
    },
    ListCategoryTreeHandler,
  ],
  exports: [ICategoryRepository],
})
export class CategoryModule {}
