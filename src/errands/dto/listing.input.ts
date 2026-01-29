import { InputType, Field } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
} from 'class-validator';
import { PricingType } from '../entities/pricingType.enum';
import { ProviderType } from '../../provider/entities/provider-type.enum';

@InputType()
export class CreateListingInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  title: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => PricingType)
  @IsEnum(PricingType)
  @IsNotEmpty()
  pricingType: PricingType;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  price?: number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  hourlyRate?: number;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  serviceId?: string;

  @Field(() => ProviderType, { nullable: true })
  @IsEnum(ProviderType)
  @IsOptional()
  providerType?: ProviderType;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  serviceAddress?: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  listingTags?: string[];

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  providerOrgId: string;
}

@InputType()
export class UpdateListingInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  title?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  price?: number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  hourlyRate?: number;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  listingTags?: string[];
}

@InputType()
export class PublishListingInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  id: string;
}
