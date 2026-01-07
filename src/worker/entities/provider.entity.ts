import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from 'src/users/entities/user.entity';
import { Search } from 'src/users/entities/search-history.entities';
import { ProviderTier } from './provider-tier.enum';
import { ProviderType } from 'src/errands/entities/providerType.enum';

@ObjectType()
export class Provider {
  @Field(() => ID)
  id: string;

  @Field(() => ProviderType, { nullable: true })
  providerType?: ProviderType;

  @Field(() => ID)
  userId: string;

  @Field(() => ProviderTier)
  tier: ProviderTier;

  @Field({ nullable: true })
  tierUpdatedAt?: Date;

  @Field(() => User)
  user: User;

  @Field(() => [Search], { nullable: 'itemsAndList' })
  searchHistory?: Search[];
}
