import { ObjectType, Field, ID } from '@nestjs/graphql';
import { DisputeStatus } from './dispute-status.enum';

@ObjectType()
export class Dispute {
  @Field(() => ID)
  id: string;

  @Field()
  errandId: string;

  @Field()
  clientId: string;

  @Field()
  workerId: string;

  @Field(() => DisputeStatus)
  status: DisputeStatus;

  @Field()
  reason: string;

  @Field()
  createdAt: Date;
}
