import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class PaymentMethod {
  @Field(() => ID)
  id: string;

  @Field()
  provider: string;

  @Field()
  type: string;

  @Field({ nullable: true })
  cardBrand?: string;

  @Field({ nullable: true })
  last4?: string;

  @Field(() => Int, { nullable: true })
  expMonth?: number;

  @Field(() => Int, { nullable: true })
  expYear?: number;

  @Field()
  isDefault: boolean;

  @Field()
  verified: boolean;
}
