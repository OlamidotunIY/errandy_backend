import { ChatThreadResponseDto } from '@module/chat';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ChatThreadType implements ChatThreadResponseDto {
  @Field()
  id!: string;

  @Field()
  errandId!: string;

  @Field(() => [String])
  participantIds!: string[];

  @Field()
  createdAt!: string;

  @Field({ nullable: true })
  closedAt?: string;

  @Field({ nullable: true })
  firstResponseAt?: string;
}
