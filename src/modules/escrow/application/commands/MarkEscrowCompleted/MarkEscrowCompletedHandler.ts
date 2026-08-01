import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { MarkEscrowCompletedCommand } from '.';
import { EscrowInvariantError, EscrowRepository } from '@module/escrow/domain';
import { ILogger } from '@src/common';

@CommandHandler(MarkEscrowCompletedCommand)
export class MarkEscrowCompletedHandler implements ICommandHandler<MarkEscrowCompletedCommand> {
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly logger: ILogger,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MarkEscrowCompletedCommand): Promise<void> {
    const { payload } = command;

    if (!payload.escrowId) {
      this.logger.error('Escrow ID is required in the payload');
      throw new EscrowInvariantError('Missing required payload fields');
    }

    this.logger.info(
      `Marking escrow with ID ${payload.escrowId.value} as completed`,
    );

    const escrow = await this.escrowRepository.findById(payload.escrowId);
    if (!escrow) {
      this.logger.error(`Escrow with ID ${payload.escrowId.value} not found`);
      throw new EscrowInvariantError('Escrow not found');
    }

    escrow.markCompleted(payload.completedAt, payload.correlationId);
    await this.escrowRepository.save(escrow);

    const events = escrow.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    this.logger.info(
      `Escrow with ID ${payload.escrowId.value} marked as completed`,
    );
  }
}
