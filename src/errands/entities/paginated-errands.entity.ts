import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ErrandWithClient } from '../entities/errand-with-client.entity';

@ObjectType()
export class PaginatedErrands {
  @Field(() => [ErrandWithClient])
  data: ErrandWithClient[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}