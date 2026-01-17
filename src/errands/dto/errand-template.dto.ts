import { InputType, Field, ID, Float, PartialType } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsMongoId,
  Min,
} from 'class-validator';
import { PricingType } from '../entities/pricingType.enum';
import { ProviderType } from '../../provider/entities/provider-type.enum';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateErrandTemplateInput {
  @Field()
  @IsString()
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => PricingType)
  @IsEnum(PricingType)
  pricingType: PricingType;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  serviceId?: string;

  @Field(() => ProviderType, { nullable: true })
  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  serviceAddress?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  location?: any;
}

@InputType()
export class UpdateErrandTemplateInput extends PartialType(
  CreateErrandTemplateInput,
) {
  @Field(() => ID)
  @IsMongoId()
  id: string;
}

@InputType()
export class CreateErrandFromTemplateInput {
  @Field(() => ID)
  @IsMongoId()
  templateId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string; // Optional override

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string; // Optional override

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  serviceAddress?: string; // Optional override
}
