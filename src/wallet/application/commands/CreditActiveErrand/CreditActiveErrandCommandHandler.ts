import { CreditActiveErrandCommand } from './';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletNotFoundError,
  WalletRepository,
} from '@wallet/domain';

@CommandHandler(CreditActiveErrandCommand)
class CreditActiveErrandCommandHandler implements ICommandHandler<CreditActiveErrandCommand> {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletBalanceSnapshotRepository: WalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreditActiveErrandCommand): Promise<void> {
    const wallet = await this.walletRepository.findById(command.walletId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const entry = wallet.recordActiveErrandCredit(
      command.amountKobo,
      command.currency,
      command.escrowId,
      command.gatewayReference,
    );

    const persistedEntry = await this.ledgerEntryRepository.append(entry);

    await this.walletBalanceSnapshotRepository.apply(
      command.walletId,
      persistedEntry,
    );

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { CreditActiveErrandCommandHandler };
