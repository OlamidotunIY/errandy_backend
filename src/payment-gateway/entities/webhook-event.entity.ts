import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class WebhookEvent {
  @Field(() => ID)
  id: string;

  @Field()
  eventId: string;

  @Field()
  provider: string;

  @Field()
  eventType: string;

  @Field(() => GraphQLJSON)
  data: any;

  @Field()
  createdAt: Date;
}
