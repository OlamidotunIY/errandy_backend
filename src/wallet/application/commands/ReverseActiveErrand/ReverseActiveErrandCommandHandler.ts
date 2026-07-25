import {
  BucketType,
  DuplicateLedgerEntryError,
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletRepository,
  LedgerEntry,
  LedgerEntryType,
  WalletNotFoundError,
} from '@wallet';
import { ReverseActiveErrandCommand } from './';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { isTransientTransactionError } from '../../../../prisma.service';

@CommandHandler(ReverseActiveErrandCommand)
class ReverseActiveErrandCommandHandler implements ICommandHandler<ReverseActiveErrandCommand> {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}
  async execute(command: ReverseActiveErrandCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(
      command.workerUserId,
    );

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const snapshotBalance =
      await this.walletBalanceRepository.getSnapshotForDisplay(wallet.id);

    const entry = wallet.recordActiveErrandReversal(
      command.amountKobo,
      command.currency,
      command.escrowId,
      command.gatewayReference,
      snapshotBalance.activeKobo,
      command.correlationId,
    );

    const maxRetries = 3;

    const persistedEntry: LedgerEntry[] = [];

    for (let attempts = 0; attempts < maxRetries; attempts++) {
      try {
        await this.ledgerEntryRepository
          .appendManyIfBalanceSufficient(
            wallet.id,
            BucketType.ACTIVE,
            snapshotBalance.activeKobo,
            [entry],
          )
          .then((entries) => {
            persistedEntry.push(...entries);
          });
        break; // Exit the loop if successful
      } catch (e) {
        if (isTransientTransactionError(e) && attempts < maxRetries - 1) {
          continue;
        }
        throw e;
      }
    }

    await this.walletBalanceRepository.apply(wallet.id, persistedEntry);

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { ReverseActiveErrandCommandHandler };
