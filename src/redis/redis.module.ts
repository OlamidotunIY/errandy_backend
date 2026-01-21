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
        const url = config.get<string>('REDIS_URL'); // e.g. redis://localhost:6379
        if (!url) throw new Error('REDIS_URL is not set');

        const redis = new Redis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
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
