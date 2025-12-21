import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
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
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { User } from 'src/users/entities/user.entity';
// PubSub interface
interface PubSub {
  publish(event: string, data: any): Promise<void>;
  asyncIterator(events: string | string[]): any;
}

@UseGuards(GqlAuthGuard)
@Resolver(() => Errand)
export class ErrandsResolver {
  constructor(
    private readonly errandsService: ErrandsService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Mutation(() => Errand)
  createErrand(
    @Args('createErrandInput') createErrandInput: CreateErrandInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.create(createErrandInput, user.id);
  }

  @Query(() => [Errand], { name: 'errands' })
  findAll(@Args('dto') dto: GetAllErrandInput, @CurrentUser() user: User) {
    return this.errandsService.findAll(dto, user.id);
  }

  @Query(() => PaginatedErrands, {
    name: 'getErrands',
    description:
      'Advanced errand query with personalized feeds and location-based filtering',
  })
  getErrands(
    @Args('input') input: ErrandQueryInput,
    @CurrentUser() user: User,
  ) {
    console.log('ErrandsResolver.getErrands - Raw input:', input);
    console.log('ErrandsResolver.getErrands - Input type:', typeof input);
    console.log(
      'ErrandsResolver.getErrands - Input keys:',
      Object.keys(input || {}),
    );
    console.log(
      'ErrandsResolver.getErrands received input:',
      JSON.stringify(input, null, 2),
    );
    return this.errandsService.getErrands(input, user.id);
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
