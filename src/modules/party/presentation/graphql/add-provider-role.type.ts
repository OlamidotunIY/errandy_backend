import { AddProviderRoleResponseDto, ProviderTier } from '@module/party';
import { Field, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@ObjectType()
export class AddProviderRoleType implements AddProviderRoleResponseDto {
  @Field()
  partyId!: string;

  @Field(() => ProviderTier)
  tier!: ProviderTier;
}
