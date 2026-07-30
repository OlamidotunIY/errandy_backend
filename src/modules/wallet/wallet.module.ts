import { Module } from '@nestjs/common';
import { WalletResolver } from 'src/modules/wallet/presentation';
import { CqrsModule } from '@nestjs/cqrs';
import { CreditActiveErrandCommandHandler } from 'src/modules/wallet/application';
import {
  LedgerBalanceCalculator,
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletRepository,
} from 'src/modules/wallet/domain';
import {
  LedgerEntryMapper,
  PrismaLedgerEntryRepository,
  PrismaWalletBalanceSnapshotRepository,
  PrismaWalletRepository,
  WalletBalanceSnapshotMapper,
  WalletMapper,
} from 'src/modules/wallet/infrastructure';

@Module({
  imports: [CqrsModule],
  providers: [
    WalletResolver,
    CreditActiveErrandCommandHandler,
    {
      provide: WalletBalanceRepository,
      useClass: PrismaWalletBalanceSnapshotRepository,
    },
    {
      provide: WalletRepository,
      useClass: PrismaWalletRepository,
    },
    {
      provide: LedgerEntryRepository,
      useClass: PrismaLedgerEntryRepository,
    },
    WalletBalanceSnapshotMapper,
    LedgerEntryMapper,
    WalletMapper,
    LedgerBalanceCalculator,
  ],
})
export class WalletModule {}
