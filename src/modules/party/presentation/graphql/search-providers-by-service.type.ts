import {
  ProviderTier,
  SearchProvidersByServiceResponseDto,
} from '@module/party';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@ObjectType()
export class ProviderSearchResultType {
  @Field()
  partyId!: string;

  @Field(() => ProviderTier)
  tier!: ProviderTier;

  @Field(() => [String])
  skills!: string[];

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => Int)
  trustedByCount!: number;

  @Field(() => Number, { nullable: true })
  avgRatingCached!: number | null;

  @Field(() => Int)
  completedErrandsCount!: number;
}

@ObjectType()
export class SearchProvidersByServiceType implements SearchProvidersByServiceResponseDto {
  @Field(() => [ProviderSearchResultType])
  providers!: ProviderSearchResultType[];
}
