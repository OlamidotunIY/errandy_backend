import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SaveErrand {
  @Field(() => String)
  id: string;

  @Field(() => String)
  errandId: string;

  @Field(() => String)
  userId: string;
}
