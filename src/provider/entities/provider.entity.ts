import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';
import { ProviderType } from './provider-type.enum';

export enum ProviderTier {
  COMMUNITY = 'COMMUNITY',
  VERIFIED = 'VERIFIED',
  CERTIFIED = 'CERTIFIED',
  COMPANY_PARTNER = 'COMPANY_PARTNER',
}

registerEnumType(ProviderTier, {
  name: 'ProviderTier',
});

@ObjectType()
export class Provider {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field(() => User)
  user: User;

  @Field(() => ProviderTier, { defaultValue: ProviderTier.COMMUNITY })
  tier: ProviderTier;

  @Field({ nullable: true })
  tierUpdatedAt?: Date;

  @Field(() => ProviderType, { nullable: true })
  providerType?: ProviderType;
}
