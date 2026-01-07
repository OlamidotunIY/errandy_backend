import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import Client from 'src/client/entities/client.entities';

@ObjectType()
export class PaymentMethod {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  provider: string;

  @Field()
  providerRef: string;

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

  @Field()
  createdAt: Date;

  @Field(() => Client, { nullable: true })
  client?: Client;
}
