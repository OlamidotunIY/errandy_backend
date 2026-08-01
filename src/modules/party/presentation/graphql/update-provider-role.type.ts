import { ProviderTier, UpdateProviderRoleResponseDto } from '@module/party';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@InputType()
export class UpdateProviderRoleInput {
  @Field({ nullable: true })
  bio?: string;

  @Field(() => [String], { nullable: true })
  skills?: string[];

  @Field({ nullable: true })
  addToSkills?: boolean;

  @Field(() => ProviderTier, { nullable: true })
  tier?: ProviderTier;
}

@ObjectType()
export class UpdateProviderRoleType implements UpdateProviderRoleResponseDto {
  @Field()
  partyId!: string;

  @Field(() => ProviderTier)
  tier!: ProviderTier;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => [String])
  skills!: string[];
}
