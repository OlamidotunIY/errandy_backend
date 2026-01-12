import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TrustedCircleService } from './trusted-circle.service';
import { TrustedCircle } from './entities/trusted-circle.entity';
import { TrustedCircleMember } from './entities/trusted-circle-member.entity';
import { AddToCircleInput } from './dto/add-to-circle.input';
import { ShareCircleInput } from './dto/share-circle.input';
import { GqlAuthGuard } from '../auth/guard/graphql-auth.guard';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => TrustedCircle)
@UseGuards(GqlAuthGuard)
export class TrustedCircleResolver {
  constructor(private readonly trustedCircleService: TrustedCircleService) {}

  @Query(() => TrustedCircle, { name: 'getTrustedCircle', nullable: true })
  getTrustedCircle(@CurrentUser() user: User) {
    return this.trustedCircleService.getTrustedCircle(user.id);
  }

  @Query(() => [TrustedCircleMember], {
    name: 'getPendingTrustedCircleMembers',
  })
  getPendingTrustedCircleMembers(@CurrentUser() user: User) {
    return this.trustedCircleService.getPendingMembers(user.id);
  }

  @Mutation(() => TrustedCircle)
  addToCircle(
    @Args('input') input: AddToCircleInput,
    @CurrentUser() user: User,
  ) {
    return this.trustedCircleService.addToCircle(user.id, input);
  }

  @Mutation(() => TrustedCircle)
  removeFromCircle(
    @Args('providerId', { type: () => ID }) providerId: string,
    @CurrentUser() user: User,
  ) {
    return this.trustedCircleService.removeFromCircle(user.id, providerId);
  }

  @Mutation(() => Boolean)
  shareTrustedCircle(
    @Args('input') input: ShareCircleInput,
    @CurrentUser() user: User,
  ) {
    return this.trustedCircleService.shareCircle(user.id, input);
  }

  @Mutation(() => TrustedCircle)
  acceptSharedProvider(
    @Args('providerId', { type: () => ID }) providerId: string,
    @CurrentUser() user: User,
  ) {
    return this.trustedCircleService.acceptSharedProvider(user.id, providerId);
  }

  @Mutation(() => TrustedCircle)
  rejectSharedProvider(
    @Args('providerId', { type: () => ID }) providerId: string,
    @CurrentUser() user: User,
  ) {
    return this.trustedCircleService.rejectSharedProvider(user.id, providerId);
  }
}
