import { InputType, Field } from '@nestjs/graphql';
import { GraphQLUpload, FileUpload } from 'graphql-upload-ts';
import { MessageType } from '../entities/message-type.enum';
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';

@InputType()
export class SendMessageInput {
  @Field()
  @IsMongoId()
  roomId: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  content?: string;

  @Field()
  @IsEnum(MessageType)
  type: MessageType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  contentUrl?: string;

  @Field(() => GraphQLUpload, { nullable: true })
  file?: Promise<FileUpload>;

  @Field()
  @IsMongoId()
  @IsOptional()
  senderId: string;
}
