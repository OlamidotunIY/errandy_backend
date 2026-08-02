import { SendMessageResponseDto } from '@module/chat';
import { Field, InputType, ObjectType } from '@nestjs/graphql';

@InputType()
export class SendMessageInput {
  @Field()
  threadId!: string;

  @Field()
  senderId!: string;

  @Field()
  content!: string;

  @Field({ nullable: true })
  isProviderSender?: boolean;
}

@ObjectType()
export class SendMessageType implements SendMessageResponseDto {
  @Field()
  messageId!: string;

  @Field()
  sentAt!: string;
}
