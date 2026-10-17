import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ProviderTier } from '../../domain';

@ObjectType()
export class MyPartyProfileType {
  @Field(() => ID)
  partyId!: string;

  @Field(() => String)
  userId!: string;

  @Field(() => String)
  marketId!: string;

  @Field(() => String)
  kind!: string;

  @Field(() => Boolean)
  hasClientRole!: boolean;

  @Field(() => Boolean)
  hasProviderRole!: boolean;

  @Field(() => ProviderTier, { nullable: true })
  providerTier?: ProviderTier;

  @Field(() => [String], { nullable: true })
  skills?: string[];

  @Field(() => String, { nullable: true })
  bio?: string;
}
