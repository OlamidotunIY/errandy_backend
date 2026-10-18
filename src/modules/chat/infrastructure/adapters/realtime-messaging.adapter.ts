import { Inject, Injectable } from '@nestjs/common';
import { PUB_SUB, SubscriptionChannels } from '@src/infrastructure/pubsub';
import { RedisPubSub } from 'graphql-redis-subscriptions';

export interface RealtimeMessagePayload {
  threadId: string;
  messageId: string;
  senderId: string;
  content: string;
  sentAt: string;
}

@Injectable()
export class RealtimeMessagingAdapter {
  constructor(
    @Inject(PUB_SUB)
    private readonly pubSub: RedisPubSub,
  ) {}

  async publish(payload: RealtimeMessagePayload): Promise<void> {
    await this.pubSub.publish(SubscriptionChannels.CHAT_MESSAGE_RECEIVED, {
      messageSent: payload,
    });
  }

  asyncIterator() {
    return this.pubSub.asyncIterator(SubscriptionChannels.CHAT_MESSAGE_RECEIVED);
  }
}
