import { InputType, Field } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

@InputType()
export class CreateChatInput {
  @Field(() => String)
  @IsMongoId()
  receiverId: string;
}
