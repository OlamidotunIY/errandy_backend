import { AddOrganizationMemberResponseDto, OrgMemberRole } from '@module/party';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@InputType()
export class AddOrganizationMemberInput {
  @Field()
  organizationPartyId!: string;

  @Field()
  userId!: string;

  @Field(() => OrgMemberRole)
  role!: OrgMemberRole;
}

@ObjectType()
export class AddOrganizationMemberType implements AddOrganizationMemberResponseDto {
  @Field()
  organizationPartyId!: string;

  @Field()
  userId!: string;

  @Field(() => OrgMemberRole)
  role!: OrgMemberRole;
}
