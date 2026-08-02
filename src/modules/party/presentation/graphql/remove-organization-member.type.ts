import { RemoveOrganizationMemberResponseDto } from '@module/party';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RemoveOrganizationMemberType implements RemoveOrganizationMemberResponseDto {
  @Field()
  organizationPartyId!: string;

  @Field()
  userId!: string;
}
