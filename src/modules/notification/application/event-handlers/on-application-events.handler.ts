import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import {
  ApplicationSubmittedEvent,
  ApplicationAcceptedEvent,
} from '@module/application/domain';
import { IPartyReadPort, ILogger } from '@src/common';
import { SendNotificationCommand } from '../commands/send-notification';

@EventsHandler(ApplicationSubmittedEvent, ApplicationAcceptedEvent)
export class OnApplicationEventsHandler
  implements IEventHandler<ApplicationSubmittedEvent | ApplicationAcceptedEvent>
{
  constructor(
    private readonly commandBus: CommandBus,
    private readonly partyReadPort: IPartyReadPort,
    private readonly logger: ILogger,
  ) {}

  async handle(
    event: ApplicationSubmittedEvent | ApplicationAcceptedEvent,
  ): Promise<void> {
    try {
      if (event instanceof ApplicationSubmittedEvent) {
        const payload = event.payload as any;
        this.logger.info('Application submitted event received for notification', {
          errandId: payload.errandId,
        });
      } else if (event instanceof ApplicationAcceptedEvent) {
        const payload = event.payload;
        const providerParty = await this.partyReadPort.findById(
          payload.providerPartyId.value,
        );
        const recipientUserId =
          providerParty?.personUserId ?? payload.providerPartyId.value;

        await this.commandBus.execute(
          new SendNotificationCommand({
            userId: recipientUserId,
            type: 'APPLICATION_ACCEPTED',
            channel: 'PUSH',
            payload: {
              title: 'Application Accepted!',
              body: 'Your application for the errand has been accepted.',
              errandId: payload.errandId.value,
              applicationId: payload.applicationId.value,
            },
          }),
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to handle application notification event',
        err as Error,
      );
    }
  }
}
