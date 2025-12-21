import { InputType, Field } from '@nestjs/graphql';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationInput } from './pagination.input';
import { ErrandType } from './errand-type.enum';

@InputType()
export class ErrandQueryInput {
  @Field(() => ErrandType, {
    nullable: true,
    description: 'Type of errand feed to retrieve',
    defaultValue: ErrandType.FEED,
  })
  @IsOptional()
  @IsEnum(ErrandType)
  type?: ErrandType;

  @Field(() => String, {
    nullable: true,
    description: 'Search keyword for title, description, or category filtering',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => PaginationInput, {
    nullable: true,
    description: 'Pagination parameters',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationInput)
  pagination?: PaginationInput;

  @Field(() => Number, {
    nullable: true,
    defaultValue: 20,
    description: 'Maximum distance in kilometers for location filtering',
  })
  @IsOptional()
  @IsNumber()
  maxDistanceKm?: number;
}
