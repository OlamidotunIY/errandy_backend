import { InputType, Field } from '@nestjs/graphql';
import { PaginationInput } from './pagination.input';

@InputType()
export class ErrandQueryInput {
  @Field(() => String, {
    description: 'Type of errand feed to retrieve',
    defaultValue: 'feed'
  })
  type: 'feed' | 'best_match' | 'most_recent' | 'saved' | 'search';

  @Field(() => String, {
    nullable: true,
    description: 'Search keyword for title, description, or category filtering'
  })
  search?: string;

  @Field(() => PaginationInput, {
    nullable: true,
    description: 'Pagination parameters'
  })
  pagination?: PaginationInput;

  @Field(() => Number, {
    nullable: true,
    defaultValue: 20,
    description: 'Maximum distance in kilometers for location filtering'
  })
  maxDistanceKm?: number;
}