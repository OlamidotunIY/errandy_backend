import { Inject, UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Args, Subscription, Query } from '@nestjs/graphql';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { User } from 'src/users/entities/user.entity';
import { ChatService } from './chat.service';
import { ChatRoom } from './entities/chat-room.entity';
import { CreateChatInput } from './dto/create-chat.input';
import { Message } from './entities/message.entity';
import { PubSubInterface } from 'src/pubsub';
import { SendMessageInput } from './dto/send-message.input';

@Resolver(() => ChatRoom)
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    @Inject('PUB_SUB') private readonly pubSub: PubSubInterface,
  ) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ChatRoom)
  getOrCreateChat(
    @Args('createChatInput') createChatInput: CreateChatInput,
    @CurrentUser() user: User,
  ) {
    const participantIds = [user.id, createChatInput.receiverId];
    return this.chatService.getOrCreateChat(participantIds);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  async sendMessage(
    @Args('sendMessageInput') sendMessageInput: SendMessageInput,
    @CurrentUser() user: User,
  ) {
    return this.chatService.sendMessage({
      ...sendMessageInput,
      senderId: user.id,
    });
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  async markMessageAsDelivered(
    @Args('messageId') messageId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.markMessageAsDelivered(messageId);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  async markMessageAsSeen(
    @Args('messageId') messageId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.markMessageAsSeen(messageId);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [ChatRoom])
  getUserChats(@CurrentUser() user: User) {
    return this.chatService.getUserChats(user.id);
  }

  @Subscription(() => Message, {
    resolve: (payload) => payload.messageSent,
  })
  messageSentForUser(@CurrentUser() user: User) {
    return this.pubSub.asyncIterator(`messageSent:${user.id}`);
  }

  @Subscription(() => Message, {
    resolve: (payload) => payload.messageDelivered,
  })
  messageDeliveredForUser(@CurrentUser() user: User) {
    return this.pubSub.asyncIterator(`messageDelivered:${user.id}`);
  }

  @Subscription(() => Message, {
    resolve: (payload) => payload.messageSeen,
  })
  messageSeenForUser(@CurrentUser() user: User) {
    return this.pubSub.asyncIterator(`messageSeen:${user.id}`);
  }
}
