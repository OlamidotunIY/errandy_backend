import { InputType, Field } from '@nestjs/graphql';
import { ProviderTier } from '../entities/provider.entity';
import { ProviderType } from '../entities/provider-type.enum';

@InputType()
export class CreateProviderInput {
  @Field()
  userId: string;

  @Field(() => ProviderTier, { nullable: true })
  tier?: ProviderTier;

  @Field(() => ProviderType, { nullable: true })
  providerType?: ProviderType;
}
