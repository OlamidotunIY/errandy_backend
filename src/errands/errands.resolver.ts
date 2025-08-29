import { Resolver, Query, Mutation, Args, Int, ID } from '@nestjs/graphql';
import { ErrandsService } from './errands.service';
import { Errand } from './entities/errand.entity';
import { CreateErrandInput } from './dto/create-errand.input';
import { UpdateErrandInput } from './dto/update-errand.input';
import { UseGuards } from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { GetAllErrandInput } from './dto/get-all-errand.input';
import { ServiceGroup } from './entities/service.entity';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';

@UseGuards(GqlAuthGuard)
@Resolver(() => Errand)
export class ErrandsResolver {
  constructor(private readonly errandsService: ErrandsService) {}

  @Mutation(() => Errand)
  createErrand(
    @Args('createErrandInput') createErrandInput: CreateErrandInput,
    @Session() session: UserSession,
  ) {
    return this.errandsService.create(createErrandInput, session.user.id);
  }

  @Query(() => [Errand], { name: 'errands' })
  findAll(
    @Args('dto') dto: GetAllErrandInput,
    @Session() session: UserSession,
  ) {
    return this.errandsService.findAll(dto, session.user.id);
  }

  @Query(() => Errand, { name: 'errand' })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.findOne(id);
  }

  @Mutation(() => Errand)
  updateErrand(
    @Args('updateErrandInput') updateErrandInput: UpdateErrandInput,
  ) {
    return this.errandsService.update(updateErrandInput);
  }

  @Mutation(() => Errand)
  removeErrand(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.remove(id);
  }

  @Query(() => [ServiceGroup], { name: 'services' })
  getServices() {
    return this.errandsService.getServices();
  }

  @Query(() => [ServiceGroup], { name: 'professions' })
  getProfessions() {
    return this.errandsService.getProfessions();
  }
}
