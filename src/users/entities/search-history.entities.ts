import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Search {
  @Field(() => ID)
  id: string;

  @Field()
  keyword: string;

  @Field(() => ID, { nullable: true })
  workerId?: string;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;
}