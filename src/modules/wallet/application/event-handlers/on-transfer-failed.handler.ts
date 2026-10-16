import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { TransferFailedEvent } from '@module/payments';
import {
  LedgerEntryRepository,
  LedgerEntryType,
  ReverseWithdrawalCommand,
} from '@module/wallet';
import { ILogger } from '@src/common';
import * as crypto from 'node:crypto';

@EventsHandler(TransferFailedEvent)
export class OnTransferFailedHandler
  implements IEventHandler<TransferFailedEvent>
{
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly commandBus: CommandBus,
    private readonly logger: ILogger,
  ) {}

  async handle(event: TransferFailedEvent): Promise<void> {
    const { gatewayReference, reason } = event.payload;

    this.logger.warn(
      `Handling TransferFailedEvent for reference ${gatewayReference}`,
      { reason },
    );

    const entries =
      await this.ledgerEntryRepository.findByGatewayReference(gatewayReference);

    const debitEntry = entries.find(
      (e) => e.type === LedgerEntryType.WITHDRAWAL_DEBIT,
    );

    if (!debitEntry) {
      this.logger.warn(
        `No WITHDRAWAL_DEBIT ledger entry found for reference ${gatewayReference}`,
      );
      return;
    }

    const alreadyReversed = entries.some(
      (e) =>
        e.type === LedgerEntryType.AVAILABLE_CREDIT &&
        e.idempotencyKey.includes(`reversal_${gatewayReference}`),
    );

    if (alreadyReversed) {
      this.logger.info(
        `Withdrawal ${gatewayReference} already reversed. Skipping duplicate reversal.`,
      );
      return;
    }

    await this.commandBus.execute(
      new ReverseWithdrawalCommand(
        debitEntry.userId,
        debitEntry.amount,
        gatewayReference,
        reason,
        event.correlationId ?? crypto.randomUUID(),
      ),
    );

    this.logger.info(
      `Successfully processed reversal for failed transfer ${gatewayReference}`,
    );
  }
}
