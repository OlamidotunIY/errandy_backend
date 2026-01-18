import { InputType, Field } from '@nestjs/graphql';
import { MessageType } from '../entities/message-type.enum';
import { IsEnum, IsMongoId, IsString } from 'class-validator';


@InputType()
export class SendMessageInput {
  @Field()
  @IsMongoId()
  roomId: string;

  @Field()
  @IsString()
  content: string;

  @Field()
  @IsEnum(MessageType)
  type: MessageType;

  @Field()
  @IsString()
  contentUrl: string;

  @Field()
  @IsMongoId()
  senderId: string;
}