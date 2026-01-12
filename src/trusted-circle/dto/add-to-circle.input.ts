import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class AddToCircleInput {
  @Field(() => ID)
  providerId: string;

  @Field({ nullable: true })
  circleName?: string;
}
