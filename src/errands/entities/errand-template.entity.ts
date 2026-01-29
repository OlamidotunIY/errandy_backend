import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { PricingType } from './pricingType.enum';
import { ProviderType } from '../../provider/entities/provider-type.enum';
import { ListingPublishState } from './listing-publish-state.enum';
import { Service } from '../../service/entities/service.entity';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class ErrandTemplate {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => PricingType)
  pricingType: PricingType;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  hourlyRate?: number;

  @Field({ nullable: true })
  serviceId?: string;

  @Field(() => ProviderType, { nullable: true })
  providerType?: ProviderType;

  @Field(() => Service, { nullable: true })
  service?: Service;

  @Field({ nullable: true })
  serviceAddress?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  location?: any;

  // Listing fields
  @Field({ nullable: true })
  providerOrgId?: string;

  @Field(() => ListingPublishState, { defaultValue: ListingPublishState.DRAFT })
  publishState: ListingPublishState;

  @Field({ nullable: true })
  publishedAt?: Date;

  @Field({ defaultValue: false })
  isListing: boolean;

  @Field(() => [String], { nullable: true })
  listingTags?: string[];

  @Field()
  createdAt: Date;
}
