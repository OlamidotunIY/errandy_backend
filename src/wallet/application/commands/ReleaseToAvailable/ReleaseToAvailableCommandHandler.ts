import {
  ILedgerEntryRepository,
  IWalletRepository,
  IWalletBalanceRepository,
  LedgerEntryType,
  DuplicateLedgerEntryError,
  WalletNotFoundError,
  BucketType,
} from '@wallet';
import { ReleaseToAvailableCommand } from '.';
import { EventBus } from '@nestjs/cqrs';

class ReleaseToAvailableCommandHandler {
  constructor(
    private readonly ledgerEntryRepository: ILedgerEntryRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly walletBalanceRepository: IWalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReleaseToAvailableCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(
      command.workerUserId,
    );

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const currentPendingBalance =
      await this.walletBalanceRepository.getPendingBalance(wallet.id);

    const [debitEntry, creditEntry] = wallet.moveToAvailable(
      command.amountKobo,
      command.currency,
      command.escrowId,
      currentPendingBalance,
    );

    await this.ledgerEntryRepository.appendManyIfBalanceSufficient(
      wallet.id,
      BucketType.PENDING,
      currentPendingBalance,
      [debitEntry, creditEntry],
    );

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { ReleaseToAvailableCommandHandler };
