import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class PaystackCustomer {
  @Field(() => ID)
  id: string;

  @Field()
  customer_code: string;

  @Field()
  customer_id: string;

  @Field()
  userId: string;

  @Field(() => GraphQLJSON, { nullable: true })
  paystackData?: any;
}
