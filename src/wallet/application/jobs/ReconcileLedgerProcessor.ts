import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import {
  LedgerEntryRepository,
  LedgerDiscrepancyDetected,
  PaystackLedgerAuditAdapter,
  ReconcileLedgerPayload,
  WalletErrorClassifier,
} from '@wallet';
import { EventBus } from '@nestjs/cqrs';
import { ErrorClassification, IDeadLetterRepository, ILogger } from '@shared';
import { Job, Queue } from 'bullmq';
import { PaymentGatewayErrorClassifier } from '@payments';

@Processor('wallet_reconcile_ledger')
export class ReconcileLedgerProcessor extends WorkerHost {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
    private readonly paystackLedgerAuditAdapter: PaystackLedgerAuditAdapter,
    private readonly deadLetterRepository: IDeadLetterRepository,
    private readonly paymentGatewayErrorClassifier: PaymentGatewayErrorClassifier,
    private readonly errorClassifier: WalletErrorClassifier,
    @InjectQueue('wallet_reconcile_ledger')
    private readonly reconcileQueue: Queue<ReconcileLedgerPayload>,
  ) {
    super();
  }

  async process(job: Job<ReconcileLedgerPayload>): Promise<any> {
    const { cursor, provider, windowStart, windowEnd, correlationId } =
      job.data;

    try {
      const page = await this.paystackLedgerAuditAdapter.fetchTransactions(
        windowStart,
        windowEnd,
        cursor,
      );

      for (const transaction of page.transactions) {
        const matchingEntries =
          await this.ledgerEntryRepository.findByGatewayReference(
            transaction.reference,
          );

        if (matchingEntries.length === 0) {
          this.eventBus.publish(
            new LedgerDiscrepancyDetected(
              transaction.reference,
              'missing',
              transaction.amountKobo,
            ),
          );
          this.logger.warn('Ledger discrepancy: missing entry', {
            reference: transaction.reference,
            correlationId,
          });
          continue;
        }

        if (matchingEntries.length > 1) {
          this.eventBus.publish(
            new LedgerDiscrepancyDetected(
              transaction.reference,
              'duplicate',
              transaction.amountKobo,
            ),
          );
          this.logger.warn('Ledger discrepancy: duplicate entry', {
            reference: transaction.reference,
            correlationId,
          });
          continue;
        }

        const [entry] = matchingEntries;
        if (entry.amountKobo !== transaction.amountKobo) {
          this.eventBus.publish(
            new LedgerDiscrepancyDetected(
              transaction.reference,
              'amount-mismatch',
              transaction.amountKobo,
            ),
          );
          this.logger.warn('Ledger discrepancy: amount mismatch', {
            reference: transaction.reference,
            correlationId,
          });
        }
      }

      if (page.nextCursor) {
        await this.reconcileQueue.add('wallet_reconcile_ledger', {
          ...job.data,
          cursor: page.nextCursor,
        });
      }
    } catch (err) {
      const isPermanent =
        this.errorClassifier.classify(err) === ErrorClassification.PERMANENT ||
        this.paymentGatewayErrorClassifier.classify(err) ===
          ErrorClassification.PERMANENT;

      if (isPermanent) {
        this.logger.error(
          'Permanent failure during ledger reconciliation — not retrying',
          err as Error,
          {
            correlationId: job.data.correlationId,
          },
        );
        await this.deadLetterRepository.record({
          queueName: 'wallet_reconcile_ledger',
          payload: {
            cursor,
            provider,
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString(),
            correlationId,
          },
          failureReason: (err as Error).message,
          attemptsMade: job.attemptsMade,
          isPermanent: true,
        });
        return;
      }

      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReconcileLedgerPayload>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.deadLetterRepository.record({
        queueName: job.name,
        payload: {
          cursor: job.data.cursor,
          provider: job.data.provider,
          windowStart: job.data.windowStart.toISOString(),
          windowEnd: job.data.windowEnd.toISOString(),
          correlationId: job.data.correlationId,
        },
        failureReason: error.message,
        attemptsMade: job.attemptsMade,
        isPermanent: false,
      });
    }
  }
}
