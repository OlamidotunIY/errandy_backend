import { InputType, Field, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsEnum } from 'class-validator';
import { GqlServiceCategoryType } from '../entities/enums';

@InputType()
export class GetServiceCategoriesInput {
  @Field(() => GqlServiceCategoryType, { nullable: true })
  @IsOptional()
  @IsEnum(GqlServiceCategoryType)
  type?: GqlServiceCategoryType;
}
