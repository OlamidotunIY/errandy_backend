import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ServiceService } from './service.service';
import { Service } from './entities/service.entity';
import { ServiceCategory } from './entities/service-category.entity';
import { GetServiceCategoriesInput } from './dto/get-service-categories.input';
import { GqlServiceCategoryType } from './entities/enums';

@Resolver(() => Service)
export class ServiceResolver {
  constructor(private readonly serviceService: ServiceService) {}

  @Query(() => [Service], { name: 'services' })
  getServices(@Args('categoryType', { type: () => GqlServiceCategoryType, nullable: true }) categoryType?: GqlServiceCategoryType) {
    return this.serviceService.getServices(categoryType);
  }

  @Query(() => [ServiceCategory], { name: 'serviceCategories' })
  getServiceCategories(@Args('input', { nullable: true }) input?: GetServiceCategoriesInput) {
    return this.serviceService.getServiceCategories(input);
  }

  @Query(() => Service, { name: 'service' })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.serviceService.findOne(id);
  }
}
