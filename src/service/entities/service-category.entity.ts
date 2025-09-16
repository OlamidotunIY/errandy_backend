import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Service } from './service.entity';
import { GqlServiceCategoryType } from './enums';



@ObjectType()
export class ServiceCategory {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => GqlServiceCategoryType)
  type: GqlServiceCategoryType;

  @Field(() => [Service], { nullable: true })
  services?: Service[];
}
