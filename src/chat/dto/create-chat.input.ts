import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CreateChatInput {
  @Field(() => String)
  @IsString()
  receiverId: string;
}
