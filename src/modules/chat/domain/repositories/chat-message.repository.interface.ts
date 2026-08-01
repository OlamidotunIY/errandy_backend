import { ChatMessage } from '../entities';

export interface ChatMessagePage {
  items: ChatMessage[];
  nextCursor?: string;
}

export abstract class IChatMessageRepository {
  abstract save(message: ChatMessage): Promise<void>;
  abstract findByThreadId(
    threadId: string,
    pagination: { limit: number; cursor?: string },
  ): Promise<ChatMessagePage>;
  abstract countByThreadIdAndSender(
    threadId: string,
    senderId: string,
  ): Promise<number>;
}
