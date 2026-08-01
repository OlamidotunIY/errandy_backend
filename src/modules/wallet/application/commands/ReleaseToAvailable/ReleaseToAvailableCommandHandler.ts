import {
  LedgerEntryRepository,
  WalletRepository,
  WalletBalanceRepository,
  WalletNotFoundError,
  BucketType,
  LedgerEntry,
} from '@module/wallet';
import { ReleaseToAvailableCommand } from '.';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { isTransientTransactionError } from '@src/prisma/prisma.service';

@CommandHandler(ReleaseToAvailableCommand)
class ReleaseToAvailableCommandHandler implements ICommandHandler<ReleaseToAvailableCommand> {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReleaseToAvailableCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(
      command.workerUserId,
    );

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const snapshotBalance =
      await this.walletBalanceRepository.getSnapshotForDisplay(wallet.id);

    const [debitEntry, creditEntry] = wallet.moveToAvailable(
      command.toMinorUnits(),
      command.currency,
      command.escrowId,
      snapshotBalance.pendingKobo,
      command.correlationId,
    );

    const maxRetries = 3;
    const persistedEntry: LedgerEntry[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.ledgerEntryRepository
          .appendManyIfBalanceSufficient(
            wallet.id,
            BucketType.PENDING,
            snapshotBalance.pendingKobo,
            [debitEntry, creditEntry],
          )
          .then((entries) => {
            persistedEntry.push(...entries);
          });
        break; // Exit the loop if successful
      } catch (e) {
        if (isTransientTransactionError(e) && attempt < maxRetries - 1) {
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

export { ReleaseToAvailableCommandHandler };
