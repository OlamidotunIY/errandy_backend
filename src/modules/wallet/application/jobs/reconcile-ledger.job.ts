import { Queue } from 'bullmq';
import {
  ISchedulerStateRepository,
  ReconcileLedgerPayload,
} from '@module/wallet';
import { ILogger } from '@src/common';

export class ReconcileLedgerJob {
  constructor(
    private readonly schedulerStateRepository: ISchedulerStateRepository,
    private readonly reconcileLedgerQueue: Queue<ReconcileLedgerPayload>,
    private readonly logger: ILogger,
  ) {}

  async enqueueDueJobs(): Promise<void> {
    const lastCursor =
      await this.schedulerStateRepository.getLastReconciledUntil();
    const windowStart = lastCursor ?? new Date();
    const windowEnd = new Date();

    const providers: Array<'paystack' | 'webhook-log'> = [
      'paystack',
      'webhook-log',
    ];

    try {
      for (const provider of providers) {
        const payload: ReconcileLedgerPayload = {
          windowStart,
          windowEnd,
          provider,
          cursor: null,
          correlationId: crypto.randomUUID(),
        };

        await this.reconcileLedgerQueue.add(
          'wallet_reconcile_ledger',
          payload,
          {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );

        await this.schedulerStateRepository.advanceCursor(windowEnd);
      }
    } catch (e) {
      this.logger.error(
        'Failed to enqueue ledger reconciliation jobs',
        e as Error,
        {
          windowStart,
          windowEnd,
        },
      );
      throw e;
    }
  }
}
