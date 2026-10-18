import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TrustedCircleMemberType {
  @Field()
  memberId!: string;

  @Field()
  status!: string;

  @Field(() => String, { nullable: true })
  sharedFromPartyId?: string | null;

  @Field(() => Date, { nullable: true })
  addedAt?: Date | null;
}

@ObjectType()
export class TrustedCircleType {
  @Field(() => ID)
  id!: string;

  @Field()
  ownerPartyId!: string;

  @Field(() => [TrustedCircleMemberType])
  members!: TrustedCircleMemberType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class AddTrustedMemberInput {
  @Field()
  memberPartyId!: string;

  @Field(() => String, { nullable: true, defaultValue: 'CONFIRMED' })
  status?: 'CONFIRMED' | 'SUGGESTED';

  @Field(() => String, { nullable: true })
  sharedFromPartyId?: string;
}
