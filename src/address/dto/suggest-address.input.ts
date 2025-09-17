import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class SuggestAddressInput {
  @Field()
  @IsString()
  @MinLength(1)
  input: string;
}
