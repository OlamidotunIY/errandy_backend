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
import { AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';
import { SaveErrand } from './entities/saveErrand.entity';
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

  @UseGuards(AuthGuard)
  @Mutation(() => Errand)
  createErrand(
    @Args('createErrandInput') createErrandInput: CreateErrandInput,
    @Session() session: UserSession,
  ) {
    return this.errandsService.create(createErrandInput, session.user.id);
  }

  @UseGuards(AuthGuard)
  @Query(() => [Errand], { name: 'errands' })
  findAll(
    @Args('dto') dto: GetAllErrandInput,
    @Session() session: UserSession,
  ) {
    return this.errandsService.findAll(dto, session.user.id);
  }

  @UseGuards(AuthGuard)
  @Query(() => PaginatedErrands, {
    name: 'getErrands',
    description:
      'Advanced errand query with personalized feeds and location-based filtering',
  })
  getErrands(
    @Args('input') input: ErrandQueryInput,
    @Session() session: UserSession,
  ) {
    return this.errandsService.getErrands(input, session.user.id);
  }

  @UseGuards(AuthGuard)
  @Query(() => Errand, { name: 'errand' })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Errand)
  updateErrand(
    @Args('updateErrandInput') updateErrandInput: UpdateErrandInput,
  ) {
    return this.errandsService.update(updateErrandInput);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Errand)
  removeErrand(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.remove(id);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => SaveErrand)
  saveErrand(
    @Args('errandId', { type: () => ID }) errandId: string,
    @Session() session: UserSession,
  ) {
    return this.errandsService.saveErrand(errandId, session.user.id);
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
