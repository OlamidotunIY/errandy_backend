import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DisputeType {
  @Field(() => ID)
  id!: string;

  @Field()
  errandId!: string;

  @Field()
  raisedById!: string;

  @Field()
  reason!: string;

  @Field()
  description!: string;

  @Field(() => [String])
  evidenceUrls!: string[];

  @Field()
  status!: string;

  @Field(() => String, { nullable: true })
  resolution?: string | null;

  @Field(() => String, { nullable: true })
  resolvedById?: string | null;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class OpenDisputeInput {
  @Field()
  errandId!: string;

  @Field()
  providerPartyId!: string;

  @Field()
  reason!: string;

  @Field()
  description!: string;

  @Field(() => [String], { nullable: true, defaultValue: [] })
  evidenceUrls?: string[];
}

@InputType()
export class ResolveDisputeInput {
  @Field()
  disputeId!: string;

  @Field(() => String, { description: 'RESOLVED | REJECTED' })
  status!: 'RESOLVED' | 'REJECTED';

  @Field()
  resolution!: string;
}
