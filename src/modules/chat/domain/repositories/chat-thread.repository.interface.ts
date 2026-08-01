import { ChatThread } from '../entities';

export abstract class IChatThreadRepository {
  abstract save(thread: ChatThread): Promise<void>;
  abstract findById(id: string): Promise<ChatThread | null>;
  abstract findByErrandId(errandId: string): Promise<ChatThread | null>;
}
