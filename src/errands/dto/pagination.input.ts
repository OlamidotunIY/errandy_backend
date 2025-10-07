import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class PaginationInput {
  @Field(() => Int, {
    defaultValue: 1,
    description: 'Page number (1-based)'
  })
  page: number;

  @Field(() => Int, {
    defaultValue: 20,
    description: 'Number of items per page'
  })
  limit: number;
}