import { InputType, Field, Int } from '@nestjs/graphql';
import { GraphQLUpload, FileUpload } from 'graphql-upload-ts';
import { MessageType } from '../entities/message-type.enum';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

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

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  fileName?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  fileSize?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  width?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  height?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  durationMs?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  waveform?: number[];

  @Field(() => GraphQLUpload, { nullable: true })
  file?: Promise<FileUpload>;

  @Field()
  @IsMongoId()
  @IsOptional()
  senderId: string;
}
