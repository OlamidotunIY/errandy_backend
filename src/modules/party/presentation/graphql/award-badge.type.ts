import { AwardBadgeResponseDto, BadgeType } from '@module/party';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@InputType()
export class AwardBadgeInput {
  @Field()
  partyId!: string;

  @Field(() => BadgeType)
  badgeType!: BadgeType;

  @Field()
  awardedByOrganizationId!: string;

  @Field()
  period!: string;
}

@ObjectType()
export class AwardBadgeType implements AwardBadgeResponseDto {
  @Field()
  badgeId!: string;

  @Field()
  partyId!: string;

  @Field(() => BadgeType)
  badgeType!: BadgeType;
}
