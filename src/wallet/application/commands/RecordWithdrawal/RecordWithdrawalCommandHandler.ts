import {
  BucketType,
  DuplicateLedgerEntryError,
  ILedgerEntryRepository,
  IWalletBalanceRepository,
  IWalletRepository,
  LedgerEntryType,
  WalletNotFoundError,
} from '@wallet';
import { RecordWithdrawalCommand } from './';
import { EventBus } from '@nestjs/cqrs';

class RecordWithdrawalCommandHandler {
  constructor(
    private readonly ledgerEntryRepository: ILedgerEntryRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly walletBalanceRepository: IWalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}
  async execute(command: RecordWithdrawalCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(command.userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const currentAvailableBalance =
      await this.walletBalanceRepository.getAvailableBalance(wallet.id);

    const entry = wallet.recordWithdrawal(
      command.amountKobo,
      command.currency,
      command.gatewayReference,
      currentAvailableBalance,
    );

    await this.ledgerEntryRepository.appendManyIfBalanceSufficient(
      wallet.id,
      BucketType.AVAILABLE,
      currentAvailableBalance,
      [entry],
    );

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { RecordWithdrawalCommandHandler };
