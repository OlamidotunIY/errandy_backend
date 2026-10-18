import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST') ?? 'localhost';
        const port = Number(config.get<string>('REDIS_PORT') ?? 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        if (url) {
          return {
            connection: { url },
          };
        }

        return {
          connection: password ? { host, port, password } : { host, port },
        };
      },
    }),

    BullModule.registerQueue(
      { name: QUEUE_NAMES.EVENT_RETRY },
      { name: QUEUE_NAMES.ACCEPT_APPLICATION },
      { name: QUEUE_NAMES.RELEASE_MATURED_ESCROWS },
      { name: QUEUE_NAMES.AUTO_ACCEPT_ERRAND },
      { name: QUEUE_NAMES.WALLET_RECONCILE_LEDGER },
      { name: QUEUE_NAMES.PAYMENT_METHOD_VERIFICATION },
      { name: QUEUE_NAMES.WITHDRAWAL_REVERSAL },
      { name: QUEUE_NAMES.BANK_ACCOUNT_RESOLUTION },
      { name: QUEUE_NAMES.PAYOUT_DISTRIBUTION },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
