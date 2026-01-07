import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Errand } from './errand.entity';

@ObjectType()
export class SavedErrand {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  errandId: string;

  @Field()
  savedAt: Date;

  @Field(() => Errand, { nullable: true })
  errand?: Errand;
}
