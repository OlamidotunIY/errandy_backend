import {
  BucketType,
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletRepository,
  LedgerEntry,
  WalletNotFoundError,
} from 'src/modules/wallet';
import { MoveActiveToPendingCommand } from '.';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { isTransientTransactionError } from '../../../../../prisma.service';

@CommandHandler(MoveActiveToPendingCommand)
class MoveActiveToPendingCommandHandler implements ICommandHandler<MoveActiveToPendingCommand> {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MoveActiveToPendingCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(
      command.workerUserId,
    );

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const snapshotBalance =
      await this.walletBalanceRepository.getSnapshotForDisplay(wallet.id);

    const [debitEntry, creditEntry] = wallet.moveActiveToPending(
      command.amountKobo,
      command.currency,
      command.escrowId,
      snapshotBalance.activeKobo,
      command.correlationId,
    );

    const maxRetries = 3;

    const persistedEntry: LedgerEntry[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.ledgerEntryRepository
          .appendManyIfBalanceSufficient(
            wallet.id,
            BucketType.ACTIVE,
            snapshotBalance.activeKobo,
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

export { MoveActiveToPendingCommandHandler };
