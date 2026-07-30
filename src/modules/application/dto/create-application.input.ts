import { InputType, Int, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateApplicationInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  errandId: string;
}
