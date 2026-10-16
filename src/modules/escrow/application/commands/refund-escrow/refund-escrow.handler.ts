import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { RefundEscrowCommand } from './refund-escrow.command';
import { EscrowInvariantError, EscrowRepository } from '@module/escrow/domain';
import { ILogger } from '@src/common';
import * as crypto from 'node:crypto';

@CommandHandler(RefundEscrowCommand)
export class RefundEscrowHandler
  implements ICommandHandler<RefundEscrowCommand, void>
{
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly logger: ILogger,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RefundEscrowCommand): Promise<void> {
    const { payload } = command;
    const escrow = await this.escrowRepository.findById(payload.escrowId);
    if (!escrow) {
      throw new EscrowInvariantError('Escrow not found');
    }

    const correlationId = payload.correlationId ?? crypto.randomUUID();
    escrow.beginRefund(payload.reason, correlationId);
    escrow.completeRefund(new Date(), correlationId);
    await this.escrowRepository.save(escrow);

    for (const event of escrow.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info(`Escrow refunded: ${payload.escrowId.value}`);
  }
}
