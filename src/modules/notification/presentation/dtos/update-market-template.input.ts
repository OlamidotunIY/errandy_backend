import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';

@InputType()
export class UpdateMarketTemplateInput {
  @Field()
  @IsString()
  marketId: string;

  @Field()
  @IsString()
  type: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field()
  @IsString()
  subject: string;

  @Field()
  @IsString()
  html: string;
}
