import { ChatMessageResponseDto } from '@module/chat';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ChatMessageType implements ChatMessageResponseDto {
  @Field()
  id!: string;

  @Field()
  threadId!: string;

  @Field()
  senderId!: string;

  @Field()
  content!: string;

  @Field()
  sentAt!: string;
}

@ObjectType()
export class ListMessagesType {
  @Field(() => [ChatMessageType])
  items!: ChatMessageType[];

  @Field({ nullable: true })
  nextCursor?: string;
}
