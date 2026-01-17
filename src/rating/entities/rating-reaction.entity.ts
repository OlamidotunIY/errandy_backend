import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class RatingReaction {
  @Field(() => ID)
  id: string;

  @Field()
  ratingId: string;

  @Field()
  userId: string;

  @Field()
  emoji: string;

  @Field()
  createdAt: Date;
}
