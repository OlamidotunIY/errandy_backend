import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  LedgerEntryRepository,
  LedgerDiscrepancyDetected,
  PaystackLedgerAuditAdapter,
  ReconcileLedgerPayload,
} from '@wallet';
import { EventBus } from '@nestjs/cqrs';
import { ILogger } from '@shared';
import { Job, Queue } from 'bullmq';

@Processor('wallet_reconcile_ledger')
export class ReconcileLedgerProcessor extends WorkerHost {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
    private readonly paystackLedgerAuditAdapter: PaystackLedgerAuditAdapter,
    @InjectQueue('wallet_reconcile_ledger')
    private readonly reconcileQueue: Queue<ReconcileLedgerPayload>,
  ) {
    super();
  }

  async process(job: Job<ReconcileLedgerPayload>): Promise<any> {
    const { cursor, provider, windowStart, windowEnd, correlationId } =
      job.data;

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
            'deplicate',
            transaction.amountKobo,
          ),
        );
        this.logger.warn('Ledger discrepancy: deplicate entry', {
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
  }
}
