import { ObjectType, Field, Float } from '@nestjs/graphql';
import { Errand } from './errand.entity';

@ObjectType()
export class ErrandWithClient extends Errand {
  @Field({ nullable: true })
  clientName?: string;

  @Field(() => Float, { nullable: true })
  clientRating?: number;

  @Field(() => Float, { nullable: true })
  distance?: number;

  @Field(() => Boolean, { nullable: true })
  isSaved?: boolean;
}
