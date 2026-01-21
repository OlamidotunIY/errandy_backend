import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateChatInput {
  @Field(() => String)
  @IsString()
  receiverId: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  roomId?: string;
}
