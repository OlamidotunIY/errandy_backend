import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { PUB_SUB } from './pubsub.constants';

/**
 * Global module that provides a single, shared RedisPubSub instance.
 *
 * Import this module once in `AppModule` — because it is `@Global()`, every
 * other module can inject `@Inject(PUB_SUB)` without adding an explicit import.
 *
 * Two separate ioredis connections are created (publisher + subscriber) as
 * required by Redis PubSub — a single connection cannot both publish and
 * subscribe simultaneously.
 */
@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');

        return new RedisPubSub({
          publisher: new Redis(redisUrl, { lazyConnect: false }),
          subscriber: new Redis(redisUrl, { lazyConnect: false }),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule {}
