import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ErrandCompletedEvent } from '@errands';
import { ILogger } from '@shared';
import { EscrowId, EscrowInvariantError } from '@escrow/domain';
import { MarkEscrowCompletedCommand } from '@escrow/application';

@EventsHandler(ErrandCompletedEvent)
export class OnErrandCompletedMarkEscrow implements IEventHandler<ErrandCompletedEvent> {
  constructor(
    private readonly logger: ILogger,
    private readonly command: CommandBus,
  ) {}

  async handle(event: ErrandCompletedEvent): Promise<void> {
    const { payload, eventId, correlationId } = event;

    if (!eventId) {
      this.logger.error('Event ID is missing');
      throw new EscrowInvariantError('Event ID is missing');
    }

    await this.command.execute(
      new MarkEscrowCompletedCommand({
        escrowId: EscrowId.fromString(payload.escrowId as string),
        correlationId: correlationId,
        completedAt: payload.CompletedAt as Date,
      }),
    );
  }
}
