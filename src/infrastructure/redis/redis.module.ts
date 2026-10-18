import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST') ?? 'localhost';
        const port = Number(config.get<string>('REDIS_PORT') ?? 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        const redis = url
          ? new Redis(url, {
              maxRetriesPerRequest: null,
              enableReadyCheck: true,
              lazyConnect: true,
            })
          : new Redis({
              host,
              port,
              password,
              maxRetriesPerRequest: null,
              enableReadyCheck: true,
              lazyConnect: true,
            });

        redis.on('connect', () => console.log('[Redis] connected'));
        redis.on('error', (err) => console.error('[Redis] error', err));

        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
