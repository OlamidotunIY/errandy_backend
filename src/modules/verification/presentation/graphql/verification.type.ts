import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class VerificationStepType {
  @Field()
  stepType!: string;

  @Field()
  status!: string;

  @Field(() => [String])
  documentUrls!: string[];

  @Field(() => Date, { nullable: true })
  submittedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  reviewedAt?: Date | null;

  @Field({ nullable: true })
  reviewerId?: string | null;

  @Field({ nullable: true })
  rejectionReason?: string | null;
}

@ObjectType()
export class VerificationProfileType {
  @Field(() => ID)
  id!: string;

  @Field()
  partyId!: string;

  @Field(() => [VerificationStepType])
  steps!: VerificationStepType[];

  @Field()
  overallStatus!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class SubmitVerificationStepInput {
  @Field({
    description: 'NIN_VERIFIED | LICENSE_VERIFIED | BUSINESS_REG_VERIFIED',
  })
  stepType!: string;

  @Field(() => [String])
  documentUrls!: string[];
}

@InputType()
export class ReviewVerificationStepInput {
  @Field()
  partyId!: string;

  @Field()
  stepType!: string;

  @Field({ description: 'APPROVED | REJECTED' })
  status!: 'APPROVED' | 'REJECTED';

  @Field({ nullable: true })
  rejectionReason?: string;
}
