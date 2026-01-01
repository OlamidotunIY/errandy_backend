import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PaymentInitializationData {
  @Field({ nullable: true })
  authorization_url?: string;

  @Field({ nullable: true })
  access_code?: string;

  @Field()
  reference: string;
}

@ObjectType()
export class PaymentInitializationResponse {
  @Field()
  status: boolean;

  @Field()
  message: string;

  // Make it optional in case of error?
  @Field(() => PaymentInitializationData, { nullable: true })
  data?: PaymentInitializationData;
}
