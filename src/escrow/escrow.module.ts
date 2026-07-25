import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MarkEscrowCompletedCommand } from '@escrow/application';
import { EscrowId } from '@escrow/domain';
import { CommandRetryRegistry } from '@shared';
import { EscrowResolver } from '@escrow/presentation/resolvers';
import { QueryBus } from '@nestjs/cqrs';

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
