import {
  DuplicateLedgerEntryError,
  ILedgerEntryRepository,
  IWalletBalanceRepository,
  IWalletRepository,
  LedgerEntryType,
  WalletNotFoundError,
} from '@wallet';
import { MoveActiveToPendingCommand } from './';
import { EventBus } from '@nestjs/cqrs';

class MoveActiveToPendingCommandHandler {
  constructor(
    private readonly ledgerEntryRepository: ILedgerEntryRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly walletBalanceRepository: IWalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MoveActiveToPendingCommand): Promise<void> {
    const alreadyExists = await this.ledgerEntryRepository.existsForEscrow(
      command.escrowId,
      LedgerEntryType.PENDING_CREDIT,
    );

    if (alreadyExists) {
      throw new DuplicateLedgerEntryError(
        command.escrowId.toString(),
        LedgerEntryType.PENDING_CREDIT,
      );
    }

    const wallet = await this.walletRepository.findByUserId(
      command.workerUserId,
    );

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const currentActiveBalance =
      await this.walletBalanceRepository.getActiveErrandBalance(wallet.id);

    const [debitEntry, creditEntry] = wallet.moveActiveToPending(
      command.amountKobo,
      command.currency,
      command.escrowId,
      currentActiveBalance,
    );

    await this.ledgerEntryRepository.appendMany([debitEntry, creditEntry]);

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { MoveActiveToPendingCommandHandler };
