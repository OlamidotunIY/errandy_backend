import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationInput } from './pagination.input';
import { MyErrandsType } from './my-errands-type.enum';

@InputType()
export class GetMyErrandsInput {
  @Field(() => MyErrandsType, {
    description: 'Type of my errands to retrieve',
  })
  @IsEnum(MyErrandsType)
  type: MyErrandsType;

  @Field(() => PaginationInput, {
    nullable: true,
    description: 'Pagination parameters',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationInput)
  pagination?: PaginationInput;
}
