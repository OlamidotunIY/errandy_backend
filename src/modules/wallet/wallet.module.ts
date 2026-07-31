import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  CreditActiveErrandCommandHandler,
  LedgerBalanceCalculator,
  LedgerEntryMapper,
  LedgerEntryRepository,
  PrismaLedgerEntryRepository,
  PrismaWalletBalanceSnapshotRepository,
  PrismaWalletRepository,
  WalletBalanceRepository,
  WalletBalanceSnapshotMapper,
  WalletMapper,
  WalletRepository,
  WalletResolver,
} from '@src/modules';

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
