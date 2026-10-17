import {
  GetChatThreadByErrandIdQuery,
  ListMessagesQuery,
  SendMessageCommand,
} from '../../application';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import {
  ChatMessageType,
  ChatThreadType,
  ListMessagesType,
  SendMessageInput,
  SendMessageType,
} from '../graphql';
import {
  RealtimeMessagePayload,
  RealtimeMessagingAdapter,
} from '../../infrastructure/adapters';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly realtimeMessagingAdapter: RealtimeMessagingAdapter,
  ) {}

  @Mutation(() => SendMessageType, {
    description: 'Send a message in a chat thread',
  })
  async sendMessage(
    @Args('input') input: SendMessageInput,
  ): Promise<SendMessageType> {
    return this.commandBus.execute(new SendMessageCommand(input));
  }

  @Query(() => ChatThreadType, {
    nullable: true,
    description: 'Get chat thread by errand ID',
  })
  async chatThreadByErrandId(
    @Args('errandId') errandId: string,
  ): Promise<ChatThreadType | null> {
    return this.queryBus.execute(
      new GetChatThreadByErrandIdQuery({ errandId }),
    );
  }

  @Query(() => ListMessagesType, {
    description: 'List paginated messages in a chat thread',
  })
  async chatMessages(
    @Args('threadId') threadId: string,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<ListMessagesType> {
    return this.queryBus.execute(
      new ListMessagesQuery({ threadId, limit, cursor }),
    );
  }

  @Subscription(() => ChatMessageType, {
    name: 'messageSent',
    description: 'Real-time subscription for messages sent to a chat thread',
    filter: (
      payload: { messageSent: RealtimeMessagePayload },
      variables: { threadId: string },
    ) => {
      return payload.messageSent.threadId === variables.threadId;
    },
    resolve: (payload: { messageSent: RealtimeMessagePayload }) => ({
      id: payload.messageSent.messageId,
      threadId: payload.messageSent.threadId,
      senderId: payload.messageSent.senderId,
      content: payload.messageSent.content,
      sentAt: payload.messageSent.sentAt,
    }),
  })
  messageSent(@Args('threadId') _threadId: string) {
    return this.realtimeMessagingAdapter.asyncIterator();
  }
}
