import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EscrowProcessor } from './processors/escrow.processor';
import { EscrowScheduler } from './scheduler/escrow.scheduler';
import { EscrowModule } from 'src/escrow/escrow.module';

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
    BullModule.registerQueue({
      name: 'escrow',
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    }),
    EscrowModule
  ],
  providers: [EscrowProcessor, EscrowScheduler],
})
export class QueuesModule {}

