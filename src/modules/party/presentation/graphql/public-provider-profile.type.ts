import {
  GetPublicProviderProfileResponseDto,
  ProviderTier,
} from '@module/party';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import './party-enums.type';

@ObjectType()
export class PublicProviderProfileType implements GetPublicProviderProfileResponseDto {
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
}
