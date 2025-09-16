import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ServiceCategoryWithServices {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;

  @Field(() => [ErrandService])
  services: ErrandService[];
}

@ObjectType()
export class ErrandService {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;
}
