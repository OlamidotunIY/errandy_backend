import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Message } from './message.entity';

@ObjectType()
export class ChatRoom {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => [String])
  participants: string[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [Message], { nullable: 'itemsAndList' })
  messages?: Message[];
}
