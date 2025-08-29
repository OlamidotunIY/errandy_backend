import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Review {
  @Field()
  id: string;

  @Field()
  reviewerId: string;

  @Field()
  workerId: string;

  @Field()
  errandId: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  comment?: string;

  @Field()
  createdAt: Date;
}
