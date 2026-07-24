import {
  BucketType,
  DuplicateLedgerEntryError,
  ILedgerEntryRepository,
  IWalletBalanceRepository,
  IWalletRepository,
  LedgerEntryType,
  WalletNotFoundError,
} from '@wallet';
import { ReverseActiveErrandCommand } from './';
import { EventBus } from '@nestjs/cqrs';

class ReverseActiveErrandCommandHandler {
  constructor(
    private readonly ledgerEntryRepository: ILedgerEntryRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly walletBalanceRepository: IWalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}
  async execute(command: ReverseActiveErrandCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(
      command.workerUserId,
    );

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const currentActiveErrandBalance =
      await this.walletBalanceRepository.getActiveErrandBalance(wallet.id);

    const entry = wallet.recordActiveErrandReversal(
      command.amountKobo,
      command.currency,
      command.escrowId,
      command.gatewayReference,
      currentActiveErrandBalance,
    );

    await this.ledgerEntryRepository.appendManyIfBalanceSufficient(
      wallet.id,
      BucketType.ACTIVE,
      currentActiveErrandBalance,
      [entry],
    );

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { ReverseActiveErrandCommandHandler };
