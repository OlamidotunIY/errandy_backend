import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { QueryBus } from '@nestjs/cqrs';
import { EscrowResolver } from './presentation/resolvers';
import { CommandRetryRegistry } from '@src/common';
import { MarkEscrowCompletedCommand } from './application';
import { EscrowId } from './domain';

@Module({
  imports: [],
  providers: [PrismaService, EscrowResolver, QueryBus],
  exports: [],
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
