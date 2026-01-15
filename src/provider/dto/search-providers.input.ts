import { InputType, Field } from '@nestjs/graphql';
import { PaginationInput } from 'src/errands/dto/pagination.input';
import { ProviderTier } from '../entities/provider.entity';
import { ProviderType } from '../entities/provider-type.enum';

@InputType()
export class SearchProvidersInput {
  @Field({ nullable: true })
  query?: string;

  @Field(() => [String], { nullable: true })
  serviceIds?: string[];

  @Field(() => [ProviderType], { nullable: true })
  providerTypes?: ProviderType[];

  @Field(() => [ProviderTier], { nullable: true })
  tiers?: ProviderTier[];

  @Field(() => Number, { nullable: true })
  minRating?: number;

  @Field(() => PaginationInput, { nullable: true })
  pagination?: PaginationInput;
}
