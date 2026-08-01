import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateApplicationInput {
  @Field()
  errandId: string;

  @Field()
  proposal: string;

  @Field(() => Int)
  proposedAmountKobo: number;

  @Field()
  currency: string;
}