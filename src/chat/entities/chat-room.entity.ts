import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Message } from './message.entity';
import { User } from 'src/users/entities/user.entity';

@ObjectType()
export class ChatRoom {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => [String])
  participantIds: string[];

  @Field(() => [User])
  participants: User[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [Message], { nullable: 'itemsAndList' })
  messages?: Message[];

  @Field(() => Int)
  unreadCount: number;
}
