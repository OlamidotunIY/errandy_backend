import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') ?? 'redis';
        const port = Number(config.get<string>('REDIS_PORT') ?? 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        return {
          connection: password ? { host, port, password } : { host, port },
        };
      },
    }),

    BullModule.registerQueue({ name: 'event-retry' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
