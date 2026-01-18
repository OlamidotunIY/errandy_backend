import { Inject, UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Args, Subscription } from '@nestjs/graphql';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { User } from 'src/users/entities/user.entity';
import { ChatService } from './chat.service';
import { ChatRoom } from './entities/chat-room.entity';
import { CreateChatInput } from './dto/create-chat.input';
import { Message } from './entities/message.entity';
import { PubSubInterface } from 'src/pubsub';

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
    const participantIds = [user.id, ...createChatInput.participantIds];
    return this.chatService.getOrCreateChat(participantIds);
  }

  @Subscription(() => Message, {
    resolve: (payload) => payload.messageSent,
  })
  messageSentForUser(@CurrentUser() user: User) {
    return this.pubSub.asyncIterator(`messageSent:${user.id}`);
  }
}
