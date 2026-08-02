import { ProviderTier, RequestTierUpgradeResponseDto } from '@module/party';
import { Field, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@ObjectType()
export class RequestTierUpgradeType implements RequestTierUpgradeResponseDto {
  @Field()
  partyId!: string;

  @Field(() => ProviderTier)
  tier!: ProviderTier;
}
