import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { RatingReaction } from './rating-reaction.entity';
import { RatingReply } from './rating-reply.entity';

export enum RateeType {
  PROVIDER = 'PROVIDER',
  CLIENT = 'CLIENT',
}

registerEnumType(RateeType, {
  name: 'RateeType',
});

@ObjectType()
export class Rating {
  @Field()
  id: string;

  @Field()
  raterId: string;

  @Field()
  rateeId: string;

  @Field(() => RateeType)
  rateeType: RateeType;

  @Field({ nullable: true })
  errandId?: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  comment?: string;

  @Field()
  createdAt: Date;

  @Field(() => [RatingReaction], { nullable: 'itemsAndList' })
  reactions?: RatingReaction[];

  @Field(() => [RatingReply], { nullable: 'itemsAndList' })
  replies?: RatingReply[];
}

@ObjectType()
export class RatingStats {
  @Field(() => Number)
  averageRating: number;

  @Field(() => Int)
  totalReviews: number;
}
