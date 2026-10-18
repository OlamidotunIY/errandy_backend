import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ICategoryReadPort } from '@src/common';
import { ListCategoryTreeHandler } from './application';
import { ICategoryRepository } from './domain';
import { CategoryMapper, CategoryReadAdapter, CategoryRepository } from './infrastructure';
import { CategoryResolver } from './presentation';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    CategoryMapper,
    CategoryResolver,
    {
      provide: ICategoryRepository,
      useClass: CategoryRepository,
    },
    CategoryReadAdapter,
    {
      provide: ICategoryReadPort,
      useClass: CategoryReadAdapter,
    },
    ListCategoryTreeHandler,
  ],
  exports: [ICategoryReadPort],
})
export class CategoryModule {}
