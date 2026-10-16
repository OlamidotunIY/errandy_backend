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
        const redisUrl = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST') ?? 'localhost';
        const port = Number(config.get<string>('REDIS_PORT') ?? 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        const redisOptions = redisUrl
          ? redisUrl
          : { host, port, password, lazyConnect: true };

        return new RedisPubSub({
          publisher:
            typeof redisOptions === 'string'
              ? new Redis(redisOptions, { lazyConnect: true })
              : new Redis(redisOptions),
          subscriber:
            typeof redisOptions === 'string'
              ? new Redis(redisOptions, { lazyConnect: true })
              : new Redis(redisOptions),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule {}
