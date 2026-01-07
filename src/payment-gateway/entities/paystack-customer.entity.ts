import { ObjectType, Field, ID } from '@nestjs/graphql';

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
}
