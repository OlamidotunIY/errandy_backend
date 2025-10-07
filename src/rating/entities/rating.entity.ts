import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Rating {
  @Field()
  id: string;

  @Field()
  raterId: string;

  @Field()
  rateeId: string;

  @Field({ nullable: true })
  errandId?: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  comment?: string;

  @Field()
  createdAt: Date;
}