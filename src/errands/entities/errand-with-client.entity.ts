import { ObjectType, Field, Float } from '@nestjs/graphql';
import { Errand } from './errand.entity';

@ObjectType()
export class ErrandWithClient extends Errand {
  @Field({ nullable: true })
  clientName?: string;

  @Field(() => Float, { nullable: true })
  clientRating?: number;
}