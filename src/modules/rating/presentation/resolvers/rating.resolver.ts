import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { IPartyReadPort } from '@src/common';
import {
  GetRatingsByErrandQuery,
  GetRatingsByRateeQuery,
  ReactToRatingCommand,
  ReplyToRatingCommand,
  SubmitRatingCommand,
} from '../../application';
import { IRatingRepository } from '../../domain';
import {
  RatingReactionType,
  RatingReplyType,
  RatingType,
  ReactToRatingInput,
  ReplyToRatingInput,
  SubmitRatingInput,
} from '../graphql';

@Resolver(() => RatingType)
export class RatingResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly partyReadPort: IPartyReadPort,
    private readonly ratingRepository: IRatingRepository,
  ) {}

  @Query(() => [RatingType], {
    description: 'Get public ratings and reviews for a provider',
  })
  async ratingsByProvider(
    @Args('providerPartyId') providerPartyId: string,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit?: number,
  ): Promise<RatingType[]> {
    return this.queryBus.execute(
      new GetRatingsByRateeQuery(providerPartyId, limit),
    );
  }

  @Query(() => [RatingType], {
    description: 'Get ratings for a completed errand',
  })
  async ratingsByErrand(
    @Args('errandId') errandId: string,
  ): Promise<RatingType[]> {
    return this.queryBus.execute(new GetRatingsByErrandQuery(errandId));
  }

  @Mutation(() => String, {
    description: 'Submit a rating for an errand participant',
  })
  @UseGuards(GqlAuthGuard)
  async submitRating(
    @CurrentUser() user: User,
    @Args('input') input: SubmitRatingInput,
  ): Promise<string> {
    const partyId = await this.partyReadPort.findPartyIdByUserId(user.id);
    if (!partyId) {
      throw new NotFoundException('Party profile not found for user');
    }

    return this.commandBus.execute(
      new SubmitRatingCommand({
        errandId: input.errandId,
        raterPartyId: partyId,
        rateePartyId: input.rateePartyId,
        score: input.score,
        comment: input.comment,
        context: 'CLIENT_FACING',
      }),
    );
  }

  @Mutation(() => RatingReactionType, {
    description: 'Add or update an emoji reaction on a rating',
  })
  @UseGuards(GqlAuthGuard)
  async reactToRating(
    @CurrentUser() user: User,
    @Args('input') input: ReactToRatingInput,
  ): Promise<RatingReactionType> {
    return this.commandBus.execute(
      new ReactToRatingCommand({
        ratingId: input.ratingId,
        userId: user.id,
        emoji: input.emoji,
      }),
    );
  }

  @Mutation(() => RatingReplyType, {
    description: 'Add a reply comment to a rating',
  })
  @UseGuards(GqlAuthGuard)
  async replyToRating(
    @CurrentUser() user: User,
    @Args('input') input: ReplyToRatingInput,
  ): Promise<RatingReplyType> {
    return this.commandBus.execute(
      new ReplyToRatingCommand({
        ratingId: input.ratingId,
        userId: user.id,
        content: input.content,
      }),
    );
  }

  @ResolveField(() => [RatingReactionType])
  async reactions(@Parent() rating: RatingType): Promise<RatingReactionType[]> {
    return this.ratingRepository.getReactions(rating.id);
  }

  @ResolveField(() => [RatingReplyType])
  async replies(@Parent() rating: RatingType): Promise<RatingReplyType[]> {
    return this.ratingRepository.getReplies(rating.id);
  }
}
