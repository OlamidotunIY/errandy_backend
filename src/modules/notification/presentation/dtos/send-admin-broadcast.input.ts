import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsArray, IsOptional } from 'class-validator';

@InputType()
export class SendAdminBroadcastInput {
  @Field()
  @IsString()
  adminId: string;

  @Field()
  @IsString()
  adminEmail: string;

  @Field()
  @IsString()
  subject: string;

  @Field()
  @IsString()
  templateId: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  targetUserIds?: string[];
}
