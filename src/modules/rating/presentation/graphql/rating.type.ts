import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RatingReactionType {
  @Field(() => ID)
  id!: string;

  @Field()
  ratingId!: string;

  @Field()
  userId!: string;

  @Field()
  emoji!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
export class RatingReplyType {
  @Field(() => ID)
  id!: string;

  @Field()
  ratingId!: string;

  @Field()
  userId!: string;

  @Field()
  content!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
export class RatingType {
  @Field(() => ID)
  id!: string;

  @Field()
  errandId!: string;

  @Field()
  raterId!: string;

  @Field()
  rateeId!: string;

  @Field()
  context!: string;

  @Field(() => Int)
  score!: number;

  @Field({ nullable: true })
  comment?: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => [RatingReactionType], { defaultValue: [] })
  reactions?: RatingReactionType[];

  @Field(() => [RatingReplyType], { defaultValue: [] })
  replies?: RatingReplyType[];
}

@InputType()
export class SubmitRatingInput {
  @Field()
  errandId!: string;

  @Field()
  rateePartyId!: string;

  @Field(() => Int, { description: 'Score between 1 and 5' })
  score!: number;

  @Field({ nullable: true })
  comment?: string;
}

@InputType()
export class ReactToRatingInput {
  @Field()
  ratingId!: string;

  @Field()
  emoji!: string;
}

@InputType()
export class ReplyToRatingInput {
  @Field()
  ratingId!: string;

  @Field()
  content!: string;
}
