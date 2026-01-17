import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class RatingReply {
  @Field(() => ID)
  id: string;

  @Field()
  ratingId: string;

  @Field()
  userId: string;

  @Field()
  content: string;

  @Field()
  createdAt: Date;
}
