import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ChatService } from './chat.service';
import { ChatRoom } from './entities/chat-room.entity';
import { CreateChatInput } from './dto/create-chat.input';
import { UpdateChatInput } from './dto/update-chat.input';

@Resolver(() => ChatRoom)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @Mutation(() => ChatRoom)
  createChat(@Args('createChatInput') createChatInput: CreateChatInput) {
    return this.chatService.create(createChatInput);
  }

  @Query(() => [ChatRoom], { name: 'chatRooms' })
  findAll() {
    return this.chatService.findAll();
  }

  @Query(() => ChatRoom, { name: 'chatRoom' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.chatService.findOne(id);
  }

  @Mutation(() => ChatRoom)
  updateChat(@Args('updateChatInput') updateChatInput: UpdateChatInput) {
    return this.chatService.update(updateChatInput.id, updateChatInput);
  }

  @Mutation(() => ChatRoom)
  removeChat(@Args('id', { type: () => Int }) id: number) {
    return this.chatService.remove(id);
  }
}
