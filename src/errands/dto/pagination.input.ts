import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, Min } from 'class-validator';

@InputType()
export class PaginationInput {
  @Field(() => Int, {
    defaultValue: 1,
    description: 'Page number (1-based)',
  })
  @IsInt()
  @Min(1)
  page: number;

  @Field(() => Int, {
    defaultValue: 20,
    description: 'Number of items per page',
  })
  @IsInt()
  @Min(1)
  limit: number;
}
