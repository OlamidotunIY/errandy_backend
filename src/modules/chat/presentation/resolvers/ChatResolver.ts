import {
  GetChatThreadByErrandIdQuery,
  ListMessagesQuery,
  SendMessageCommand,
} from '@module/chat';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, Int, Query, Mutation, Resolver } from '@nestjs/graphql';
import {
  ChatThreadType,
  ListMessagesType,
  SendMessageInput,
  SendMessageType,
} from '../graphql';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Mutation(() => SendMessageType)
  async sendMessage(
    @Args('input') input: SendMessageInput,
  ): Promise<SendMessageType> {
    return this.commandBus.execute(new SendMessageCommand(input));
  }

  @Query(() => ChatThreadType, { nullable: true })
  async chatThreadByErrandId(
    @Args('errandId') errandId: string,
  ): Promise<ChatThreadType | null> {
    return this.queryBus.execute(
      new GetChatThreadByErrandIdQuery({ errandId }),
    );
  }

  @Query(() => ListMessagesType)
  async chatMessages(
    @Args('threadId') threadId: string,
    @Args('limit', { type: () => Int }) limit: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<ListMessagesType> {
    return this.queryBus.execute(
      new ListMessagesQuery({ threadId, limit, cursor }),
    );
  }
}
