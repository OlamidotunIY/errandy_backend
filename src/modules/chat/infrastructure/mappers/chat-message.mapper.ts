import { Injectable } from '@nestjs/common';
import { ChatMessage as PrismaChatMessage, Prisma } from '@prisma/client';
import { ChatMessage, ChatMessageId } from '@module/chat/domain';

@Injectable()
export class ChatMessageMapper {
  toDomain(record: PrismaChatMessage): ChatMessage {
    return new ChatMessage(
      ChatMessageId.fromString(record.id),
      record.threadId,
      record.senderId,
      record.content,
      record.sentAt,
    );
  }

  toPersistence(message: ChatMessage): Prisma.ChatMessageUncheckedCreateInput {
    return {
      id: message.id.value,
      threadId: message.threadId,
      senderId: message.senderId,
      content: message.content,
      sentAt: message.sentAt,
    };
  }
}
