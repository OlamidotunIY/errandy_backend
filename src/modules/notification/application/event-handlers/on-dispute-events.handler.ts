import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { DisputeOpenedEvent } from '@module/dispute/domain';
import { IPartyReadPort, ILogger } from '@src/common';
import { SendNotificationCommand } from '../commands/send-notification';

@EventsHandler(DisputeOpenedEvent)
export class OnDisputeEventsHandler
  implements IEventHandler<DisputeOpenedEvent>
{
  constructor(
    private readonly commandBus: CommandBus,
    private readonly partyReadPort: IPartyReadPort,
    private readonly logger: ILogger,
  ) {}

  async handle(event: DisputeOpenedEvent): Promise<void> {
    try {
      const party = await this.partyReadPort.findById(event.payload.partyId);
      const userId = party?.personUserId ?? event.payload.partyId;

      await this.commandBus.execute(
        new SendNotificationCommand({
          userId,
          type: 'DISPUTE_OPENED',
          channel: 'EMAIL',
          payload: {
            subject: 'A dispute has been opened',
            body: 'A dispute was raised on your errand. Our support team will review the details.',
          },
        }),
      );
    } catch (err) {
      this.logger.error(
        'Failed to handle dispute notification event',
        err as Error,
      );
    }
  }
}
