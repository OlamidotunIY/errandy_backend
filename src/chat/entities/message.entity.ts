import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
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

  @Field({ nullable: true })
  content?: string;

  @Field({ nullable: true })
  contentUrl?: string;

  @Field({ nullable: true })
  fileName?: string;

  @Field(() => Int, { nullable: true })
  fileSize?: number;

  @Field({ nullable: true })
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  width?: number;

  @Field(() => Int, { nullable: true })
  height?: number;

  @Field(() => Int, { nullable: true })
  durationMs?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  waveform?: number[];

  @Field(() => MessageType)
  type: MessageType;

  @Field()
  seen: boolean;

  @Field()
  sent: boolean;

  @Field()
  delivered: boolean;

  @Field(() => [Reaction], { nullable: 'itemsAndList' })
  reactions?: Reaction[];

  @Field()
  createdAt: Date;
}
