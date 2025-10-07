import { ObjectType, Field } from '@nestjs/graphql';
import { Errand } from './errand.entity';

@ObjectType()
export class ErrandSubscriptionPayload {
  @Field(() => Errand)
  errand: Errand;

  @Field(() => String)
  type: 'CREATED' | 'UPDATED' | 'DELETED';

  @Field(() => String, { nullable: true })
  userId?: string;

  @Field(() => Number, { nullable: true })
  distance?: number;
}