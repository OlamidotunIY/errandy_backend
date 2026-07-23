import {
  ILedgerEntryRepository,
  IWalletRepository,
  LedgerEntryType,
  DuplicateLedgerEntryError,
  WalletNotFoundError,
  ActiveErrandCredited,
} from '@wallet';
import { CreditActiveErrandCommand } from './CreditActiveErrandCommand';
import { EventBus } from '@nestjs/cqrs';

class CreditActiveErrandCommandHandler {
  constructor(
    private readonly ledgerEntryRepository: ILedgerEntryRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreditActiveErrandCommand): Promise<void> {
    const alreadyExists = await this.ledgerEntryRepository.existsForEscrow(
      command.escrowId,
      LedgerEntryType.ACTIVE_ERRAND_CREDIT,
    );

    if (alreadyExists) {
      throw new DuplicateLedgerEntryError(
        command.escrowId.toString(),
        LedgerEntryType.ACTIVE_ERRAND_CREDIT,
      );
    }

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

    await this.ledgerEntryRepository.append(entry);

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}

export { CreditActiveErrandCommandHandler };
