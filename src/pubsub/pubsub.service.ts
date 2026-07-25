import { Inject, Injectable } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { REDIS } from '../infrastructure/redis/redis.module';

export interface PubSubInterface {
  publish(event: string, data: any): Promise<void>;
  asyncIterator(events: string | string[]): AsyncIterator<any>;
}

export const PUBSUB = Symbol('PUBSUB');

@Injectable()
export class PubSubService implements PubSubInterface {
  private pubSub: RedisPubSub;

  constructor(@Inject(REDIS) private readonly redis: Redis) {
    /**
     * RedisPubSub needs separate publisher/subscriber connections.
     * We still use ONE redis instance config/url, but create 2 logical clients.
     * (This is required by Redis pubsub semantics.)
     */
    const publisher = this.redis.duplicate();
    const subscriber = this.redis.duplicate();

    this.pubSub = new RedisPubSub({
      publisher,
      subscriber,
    });
  }

  async publish(event: string, data: any): Promise<void> {
    await this.pubSub.publish(event, data);
  }

  asyncIterator(events: string | string[]): AsyncIterator<any> {
    return this.pubSub.asyncIterator(events);
  }
}
