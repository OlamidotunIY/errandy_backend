import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateErrandInput {
  @Field(() => String, { description: 'Errand title' })
  title: string;
}
