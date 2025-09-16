import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ServiceCategory } from './service-category.entity';
import { GqlServiceCategoryType } from './enums';

@ObjectType()
export class Service {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => GqlServiceCategoryType)
  type: GqlServiceCategoryType;

  @Field()
  categoryId: string;

  @Field(() => ServiceCategory, { nullable: true })
  category?: ServiceCategory;
}
