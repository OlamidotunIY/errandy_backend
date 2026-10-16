import {
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletRepository,
  WalletNotFoundError,
} from '@module/wallet';
import { ReverseWithdrawalCommand } from './reverse-withdrawal.command';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(ReverseWithdrawalCommand)
export class ReverseWithdrawalCommandHandler
  implements ICommandHandler<ReverseWithdrawalCommand>
{
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletBalanceSnapshotRepository: WalletBalanceRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReverseWithdrawalCommand): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(command.userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const entry = wallet.recordWithdrawalReversal(
      command.amount,
      command.gatewayReference,
      command.reason,
      command.correlationId,
    );

    const persistedEntry = await this.ledgerEntryRepository.append(entry);

    await this.walletBalanceSnapshotRepository.apply(
      wallet.id,
      persistedEntry,
    );

    const events = wallet.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}
