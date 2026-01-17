import { InputType, Field, ID, Float, PartialType } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsMongoId,
  IsBoolean,
  Min,
  IsArray,
} from 'class-validator';

@InputType()
export class CreateErrandBundleInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  description: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  basePrice: number;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  templateIds?: string[];
}

@InputType()
export class UpdateErrandBundleInput extends PartialType(
  CreateErrandBundleInput,
) {
  @Field(() => ID)
  @IsMongoId()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@InputType()
export class AddBundleItemInput {
  @Field(() => ID)
  @IsMongoId()
  bundleId: string;

  @Field(() => ID)
  @IsMongoId()
  templateId: string;
}

@InputType()
export class RemoveBundleItemInput {
  @Field(() => ID)
  @IsMongoId()
  bundleId: string;

  @Field(() => ID)
  @IsMongoId()
  templateId: string;
}

@InputType()
export class CreateErrandsFromBundleInput {
  @Field(() => ID)
  @IsMongoId()
  bundleId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  serviceAddress?: string;
}
