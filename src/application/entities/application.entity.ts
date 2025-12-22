import { ObjectType, Field, Int, ID } from '@nestjs/graphql';
import { ApplicationStatus } from './applicationStatus.enum';

@ObjectType()
export class Application {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  workerId: string;

  @Field(() => String)
  errandId: string;

  @Field(() => ApplicationStatus)
  status: ApplicationStatus;

  @Field(() => Date)
  createdAt: Date;
}
