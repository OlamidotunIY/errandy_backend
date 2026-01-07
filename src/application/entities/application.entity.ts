import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ApplicationStatus } from './applicationStatus.enum';
import { ApplicationSource } from './application-source.enum';

@ObjectType()
export class Application {
  @Field(() => ID)
  id: string;

  @Field()
  errandId: string;

  @Field()
  workerId: string;

  @Field(() => ApplicationStatus)
  status: ApplicationStatus;

  @Field({ nullable: true })
  acceptedAt?: Date;

  @Field(() => ApplicationSource)
  source: ApplicationSource;

  @Field()
  createdAt: Date;
}
