import { ObjectType, Field, ID } from '@nestjs/graphql';
import { MessageType } from './message-type.enum';
import { Reaction } from './reaction.entity';

@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field()
  roomId: string;

  @Field()
  senderId: string;

  @Field()
  receiverId: string;

  @Field({ nullable: true })
  content?: string;

  @Field({ nullable: true })
  contentUrl?: string;

  @Field(() => MessageType)
  type: MessageType;

  @Field()
  seen: boolean;

  @Field()
  delivered: boolean;

  @Field(() => [Reaction], { nullable: 'itemsAndList' })
  reactions?: Reaction[];

  @Field()
  createdAt: Date;
}
