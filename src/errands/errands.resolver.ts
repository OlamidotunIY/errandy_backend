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
import { ErrandTemplate } from './entities/errand-template.entity';
import { ErrandBundle } from './entities/errand-bundle.entity';
import { RecurringErrand } from './entities/recurring-errand.entity';
import { BundleItem } from './entities/bundle-item.entity';
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
import {
  CreateErrandTemplateInput,
  UpdateErrandTemplateInput,
  CreateErrandFromTemplateInput,
} from './dto/errand-template.dto';
import {
  CreateRecurringErrandInput,
  UpdateRecurringErrandInput,
} from './dto/recurring-errand.dto';
import {
  CreateErrandBundleInput,
  UpdateErrandBundleInput,
  AddBundleItemInput,
  RemoveBundleItemInput,
  CreateErrandsFromBundleInput,
} from './dto/errand-bundle.dto';

@Resolver(() => Errand)
export class ErrandsResolver {
  constructor(
    private readonly errandsService: ErrandsService,
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

  // ==========================================
  // ERRAND TEMPLATE RESOLVERS
  // ==========================================

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ErrandTemplate)
  createErrandTemplate(
    @Args('input') input: CreateErrandTemplateInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.createTemplate(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ErrandTemplate)
  updateErrandTemplate(@Args('input') input: UpdateErrandTemplateInput) {
    return this.errandsService.updateTemplate(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ErrandTemplate)
  deleteErrandTemplate(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.deleteTemplate(id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [ErrandTemplate], { name: 'myErrandTemplates' })
  getMyErrandTemplates(@CurrentUser() user: User) {
    return this.errandsService.getMyTemplates(user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => ErrandTemplate, { name: 'errandTemplate', nullable: true })
  getErrandTemplate(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.getTemplateById(id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Errand)
  createErrandFromTemplate(
    @Args('input') input: CreateErrandFromTemplateInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.createErrandFromTemplate(
      input.templateId,
      user.id,
      {
        title: input.title,
        description: input.description,
        serviceAddress: input.serviceAddress,
      },
    );
  }

  // ==========================================
  // RECURRING ERRAND RESOLVERS
  // ==========================================

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RecurringErrand)
  createRecurringErrand(
    @Args('input') input: CreateRecurringErrandInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.createRecurringErrand(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RecurringErrand)
  updateRecurringErrand(@Args('input') input: UpdateRecurringErrandInput) {
    return this.errandsService.updateRecurringErrand(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RecurringErrand)
  cancelRecurringErrand(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.cancelRecurringErrand(id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RecurringErrand)
  deleteRecurringErrand(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.deleteRecurringErrand(id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [RecurringErrand], { name: 'myRecurringErrands' })
  getMyRecurringErrands(@CurrentUser() user: User) {
    return this.errandsService.getMyRecurringErrands(user.id);
  }

  // ==========================================
  // ERRAND BUNDLE RESOLVERS
  // ==========================================

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ErrandBundle)
  createErrandBundle(
    @Args('input') input: CreateErrandBundleInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.createBundle(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ErrandBundle)
  updateErrandBundle(@Args('input') input: UpdateErrandBundleInput) {
    return this.errandsService.updateBundle(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ErrandBundle)
  deleteErrandBundle(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.deleteBundle(id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => BundleItem)
  addBundleItem(@Args('input') input: AddBundleItemInput) {
    return this.errandsService.addBundleItem(input.bundleId, input.templateId);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => BundleItem)
  removeBundleItem(@Args('input') input: RemoveBundleItemInput) {
    return this.errandsService.removeBundleItem(
      input.bundleId,
      input.templateId,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [ErrandBundle], { name: 'errandBundles' })
  getErrandBundles() {
    return this.errandsService.getBundles();
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => ErrandBundle, { name: 'errandBundle', nullable: true })
  getErrandBundle(@Args('id', { type: () => ID }) id: string) {
    return this.errandsService.getBundleById(id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => [Errand])
  createErrandsFromBundle(
    @Args('input') input: CreateErrandsFromBundleInput,
    @CurrentUser() user: User,
  ) {
    return this.errandsService.createErrandsFromBundle(
      input.bundleId,
      user.id,
      input.serviceAddress,
    );
  }
}
