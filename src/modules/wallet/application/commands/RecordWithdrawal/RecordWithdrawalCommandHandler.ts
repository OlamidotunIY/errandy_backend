import {
  BucketType,
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletRepository,
  LedgerEntry,
  WalletNotFoundError,
} from '@module/wallet';
import { RecordWithdrawalCommand } from '.';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { isTransientTransactionError } from '@src/prisma/prisma.service';

@CommandHandler(RecordWithdrawalCommand)
class RecordWithdrawalCommandHandler implements ICommandHandler<RecordWithdrawalCommand> {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}
  async execute(command: RecordWithdrawalCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(command.userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const snapshotBalance =
      await this.walletBalanceRepository.getSnapshotForDisplay(wallet.id);

    const entry = wallet.recordWithdrawal(
      command.amountKobo,
      command.currency,
      command.gatewayReference,
      snapshotBalance.availableKobo,
      command.correlationId,
    );

    const maxRetries = 3;
    const persistedEntry: LedgerEntry[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.ledgerEntryRepository
          .appendManyIfBalanceSufficient(
            wallet.id,
            BucketType.AVAILABLE,
            snapshotBalance.availableKobo,
            [entry],
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

export { RecordWithdrawalCommandHandler };
