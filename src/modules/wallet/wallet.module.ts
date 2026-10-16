import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@src/infrastructure/queue/queue.constants';
import { PaymentGatewayErrorClassifier } from '@module/payments';
import {
  // Command Handlers
  CreditActiveErrandCommandHandler,
  MoveActiveToPendingCommandHandler,
  ReleaseToAvailableCommandHandler,
  ReverseActiveErrandCommandHandler,
  RecordWithdrawalCommandHandler,
  // Query Handlers
  GetLedgerHistoryQueryHandler,
  GetWalletBalancesHandler,
  // Processors & Jobs
  ReconcileLedgerProcessor,
  // Services & Mappers & Adapters
  LedgerBalanceCalculator,
  LedgerEntryMapper,
  WalletBalanceSnapshotMapper,
  WalletMapper,
  PaystackLedgerAuditAdapter,
  // Errors & Classifiers
  WalletErrorClassifier,
  // Repositories
  LedgerEntryRepository,
  PrismaLedgerEntryRepository,
  PrismaWalletBalanceSnapshotRepository,
  PrismaWalletRepository,
  WalletBalanceRepository,
  WalletRepository,
  IBankAccountRepository,
  PrismaBankAccountRepository,
  // Presentation
  WalletResolver,
} from './';

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.WALLET_RECONCILE_LEDGER,
    }),
  ],
  providers: [
    // Resolvers
    WalletResolver,

    // Command Handlers
    CreditActiveErrandCommandHandler,
    MoveActiveToPendingCommandHandler,
    ReleaseToAvailableCommandHandler,
    ReverseActiveErrandCommandHandler,
    RecordWithdrawalCommandHandler,

    // Query Handlers
    GetLedgerHistoryQueryHandler,
    GetWalletBalancesHandler,

    // Processors
    ReconcileLedgerProcessor,

    // Adapters & Classifiers
    PaystackLedgerAuditAdapter,
    WalletErrorClassifier,
    PaymentGatewayErrorClassifier,

    // Repositories
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
    {
      provide: IBankAccountRepository,
      useClass: PrismaBankAccountRepository,
    },

    // Mappers & Domain Services
    WalletBalanceSnapshotMapper,
    LedgerEntryMapper,
    WalletMapper,
    LedgerBalanceCalculator,
  ],
  exports: [
    WalletRepository,
    WalletBalanceRepository,
    LedgerEntryRepository,
    IBankAccountRepository,
  ],
})
export class WalletModule {}
