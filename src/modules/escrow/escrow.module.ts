import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EscrowResolver } from './presentation/resolvers';
import { CommandRetryRegistry } from '@src/common';
import {
  FundEscrowHandler,
  MarkEscrowCompletedCommand,
  MarkEscrowCompletedHandler,
  RefundEscrowHandler,
  ReleaseEscrowHandler,
  GetEscrowByErrandHandler,
} from './application';
import { OnErrandCompletedMarkEscrow } from './application/events';
import { ReleaseMaturedEscrowsProcessor } from './application/jobs';
import {
  EscrowId,
  EscrowRepository,
  EscrowErrorClassifier,
} from './domain';
import {
  EscrowMapper,
  PrismaEscrowRepository,
  StandardPlatformFeePolicy,
} from './infrastructure';

@Module({
  imports: [CqrsModule],
  providers: [
    EscrowMapper,
    EscrowErrorClassifier,
    StandardPlatformFeePolicy,
    {
      provide: EscrowRepository,
      useClass: PrismaEscrowRepository,
    },
    // Command Handlers
    FundEscrowHandler,
    MarkEscrowCompletedHandler,
    RefundEscrowHandler,
    ReleaseEscrowHandler,
    // Query Handlers
    GetEscrowByErrandHandler,
    // Event Handlers & Processors
    OnErrandCompletedMarkEscrow,
    ReleaseMaturedEscrowsProcessor,
    // Resolver
    EscrowResolver,
  ],
  exports: [EscrowRepository, EscrowMapper],
})
export class EscrowModule implements OnModuleInit {
  constructor(private readonly commandRetryRegistry: CommandRetryRegistry) {}

  onModuleInit() {
    this.commandRetryRegistry.register('MarkEscrowCompletedCommand', {
      reconstruct: (payload) =>
        new MarkEscrowCompletedCommand({
          escrowId: EscrowId.fromString(payload.escrowId as string),
          completedAt: new Date(payload.completedAt as string),
          correlationId: payload.correlationId as string,
        }),
    });
  }
}
