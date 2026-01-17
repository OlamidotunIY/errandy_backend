import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RatingService } from './rating.service';
import { Rating } from './entities/rating.entity';
import { RatingReaction } from './entities/rating-reaction.entity';
import { RatingReply } from './entities/rating-reply.entity';
import {
  AddRatingReactionInput,
  AddRatingReplyInput,
  DeleteRatingReplyInput,
} from './dto/rating-interaction.dto';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Resolver(() => Rating)
export class RatingResolver {
  constructor(private readonly ratingService: RatingService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [Rating], { name: 'clientRatings' })
  async getClientRatings(
    @Args('clientId', { type: () => ID }) clientId: string,
  ) {
    return this.ratingService.getClientRatings(clientId);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [Rating], { name: 'errandRatings' })
  async getErrandRatings(
    @Args('errandId', { type: () => ID }) errandId: string,
  ) {
    return this.ratingService.getErrandRatings(errandId);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RatingReaction, { nullable: true })
  async toggleRatingReaction(
    @Args('input') input: AddRatingReactionInput,
    @CurrentUser() user: User,
  ) {
    return this.ratingService.toggleReaction(
      input.ratingId,
      user.id,
      input.emoji,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RatingReply)
  async addRatingReply(
    @Args('input') input: AddRatingReplyInput,
    @CurrentUser() user: User,
  ) {
    return this.ratingService.addReply(input.ratingId, user.id, input.content);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RatingReply)
  async deleteRatingReply(
    @Args('input') input: DeleteRatingReplyInput,
    @CurrentUser() user: User,
  ) {
    return this.ratingService.deleteReply(input.replyId, user.id);
  }
}
