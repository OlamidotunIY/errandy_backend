import { Module } from '@nestjs/common';
import { WalletResolver } from 'src/modules/wallet/presentation';
import { CqrsModule } from '@nestjs/cqrs';
import { CreditActiveErrandCommandHandler } from '@module/wallet/application';
import {
  LedgerBalanceCalculator,
  LedgerEntryRepository,
  WalletBalanceRepository,
  WalletRepository,
} from '@module/wallet/domain';
import {
  LedgerEntryMapper,
  PrismaLedgerEntryRepository,
  PrismaWalletBalanceSnapshotRepository,
  PrismaWalletRepository,
  WalletBalanceSnapshotMapper,
  WalletMapper,
} from '@module/wallet/infrastructure';

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
