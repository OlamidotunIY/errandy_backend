import { ReleaseEscrowCommand } from './';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { EscrowInvariantError, EscrowRepository } from '@escrow/domain';
import { ILogger } from '@shared';

@CommandHandler(ReleaseEscrowCommand)
export class ReleaseEscrowHandler implements ICommandHandler<ReleaseEscrowCommand> {
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly logger: ILogger,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReleaseEscrowCommand): Promise<void> {
    const { payload } = command;

    if (!payload.escrowId) {
      throw new EscrowInvariantError('Missing required payload fields');
    }

    const escrow = await this.escrowRepository.findById(payload.escrowId);

    if (!escrow) {
      this.logger.error(
        `Escrow not found for ID: ${payload.escrowId.value}`,
        {} as Error,
      );
      throw new EscrowInvariantError('Escrow not found');
    }

    escrow.beginRelease(payload.correlationId);
    escrow.completeRelease(new Date(), payload.correlationId);
    await this.escrowRepository.save(escrow);

    const events = escrow.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    this.logger.warn(`Escrow released for ID: ${payload.escrowId.value}`);
  }
}
