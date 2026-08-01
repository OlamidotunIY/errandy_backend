import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface RealtimeMessagePayload {
  threadId: string;
  messageId: string;
  senderId: string;
  content: string;
  sentAt: string;
}

/**
 * NOTE: placeholder adapter. No GraphQL subscription/PubSub transport is
 * wired into the project yet (only `graphql-ws` transport config exists,
 * no `graphql-subscriptions` PubSub dependency). This wraps a local
 * EventEmitter so callers have a stable interface to publish/subscribe to
 * new chat messages, ready to be swapped for a real PubSub-backed
 * implementation once GraphQL subscriptions are introduced.
 */
@Injectable()
export class RealtimeMessagingAdapter {
  private readonly emitter = new EventEmitter();

  publish(payload: RealtimeMessagePayload): void {
    this.emitter.emit(`chat-thread:${payload.threadId}`, payload);
  }

  subscribe(
    threadId: string,
    listener: (payload: RealtimeMessagePayload) => void,
  ): () => void {
    const eventName = `chat-thread:${threadId}`;
    this.emitter.on(eventName, listener);
    return () => this.emitter.off(eventName, listener);
  }
}
