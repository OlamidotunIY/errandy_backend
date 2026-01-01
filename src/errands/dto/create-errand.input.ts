import { InputType, Int, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateErrandInput {
  @Field(() => String, { description: 'Errand title' })
  @IsString()
  @IsNotEmpty()
  title: string;
}
