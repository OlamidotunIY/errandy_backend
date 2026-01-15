import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Subscription,
} from '@nestjs/graphql';
import { ErrandsService } from './errands.service';
import { Errand } from './entities/errand.entity';
import { CreateErrandInput } from './dto/create-errand.input';
import { UpdateErrandInput } from './dto/update-errand.input';
import { ErrandQueryInput } from './dto/errand-query.input';
import { PaginatedErrands } from './entities/paginated-errands.entity';
import { ErrandSubscriptionPayload } from './entities/errand-subscription.entity';
import { UseGuards, Inject } from '@nestjs/common';
import { GetAllErrandInput } from './dto/get-all-errand.input';
import { GetErrandInput } from './dto/get-errand.input';
import { SavedErrand } from './entities/saveErrand.entity';
import { GetMyErrandsInput } from './dto/get-my-errands.input';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { User } from 'src/users/entities/user.entity';
// PubSub interface
interface PubSub {
  publish(event: string, data: any): Promise<void>;
  asyncIterator(events: string | string[]): any;
}

@Resolver(() => Errand)
export class ErrandsResolver {
  constructor(
    private readonly errandsService: ErrandsService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Errand)
  createErrand(
    @Args('createErrandInput') createErrandInput: CreateErrandInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.create(createErrandInput, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [Errand], { name: 'errands' })
  findAll(@Args('dto') dto: GetAllErrandInput, @CurrentUser() user: User) {
    return this.errandsService.findAll(dto, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => PaginatedErrands, {
    name: 'getErrands',
    description:
      'Advanced errand query with personalized feeds and location-based filtering',
  })
  getErrands(
    @Args('input') input: ErrandQueryInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.getErrands(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Errand, { name: 'errand' })
  findOne(@Args('input') input: GetErrandInput) {
    return this.errandsService.findOne(input.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Errand)
  updateErrand(
    @Args('updateErrandInput') updateErrandInput: UpdateErrandInput,
  ) {
    return this.errandsService.update(updateErrandInput);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Errand)
  removeErrand(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.remove(id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavedErrand)
  saveErrand(
    @Args('errandId', { type: () => ID }) errandId: string,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.saveErrand(errandId, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => PaginatedErrands, {
    name: 'getMyErrands',
    description:
      'Get user errands - Clients see their created errands, Providers see errands they applied for',
  })
  getMyErrands(
    @Args('input') input: GetMyErrandsInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.getMyErrands(input, user.id);
  }

  // Real-time Subscriptions
  @Subscription(() => ErrandSubscriptionPayload, {
    name: 'errandCreated',
    description: 'Subscribe to new errands created nearby',
  })
  errandCreated() {
    return this.pubSub.asyncIterator('errandCreated');
  }

  @Subscription(() => ErrandSubscriptionPayload, {
    name: 'errandUpdated',
    description: 'Subscribe to errand updates',
  })
  errandUpdated() {
    return this.pubSub.asyncIterator('errandUpdated');
  }

  @Subscription(() => ErrandSubscriptionPayload, {
    name: 'errandDeleted',
    description: 'Subscribe to errand deletions',
  })
  errandDeleted() {
    return this.pubSub.asyncIterator('errandDeleted');
  }
}
