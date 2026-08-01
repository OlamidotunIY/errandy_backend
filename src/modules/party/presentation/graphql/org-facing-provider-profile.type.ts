import {
  BadgeType,
  GetOrgFacingProviderProfileResponseDto,
  ProviderTier,
} from '@module/party';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@ObjectType()
export class ProviderBadgeSummaryType {
  @Field(() => BadgeType)
  badgeType!: BadgeType;

  @Field()
  awardedByOrganizationId!: string;

  @Field()
  period!: string;

  @Field(() => Date)
  awardedAt!: Date;
}

@ObjectType()
export class OrgFacingProviderProfileType implements GetOrgFacingProviderProfileResponseDto {
  @Field()
  partyId!: string;

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => [String])
  skills!: string[];

  @Field(() => ProviderTier)
  tier!: ProviderTier;

  @Field(() => Int)
  trustedByCount!: number;

  @Field(() => Number, { nullable: true })
  avgRatingCached!: number | null;

  @Field(() => Int)
  completedErrandsCount!: number;

  @Field(() => Int)
  disputedErrandsCount!: number;

  @Field(() => Int, { nullable: true })
  avgResponseTimeSeconds!: number | null;

  @Field(() => [ProviderBadgeSummaryType])
  badges!: ProviderBadgeSummaryType[];
}
