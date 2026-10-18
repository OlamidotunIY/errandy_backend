import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import {
  EmailDeliveryRequestedEvent,
  SmsDeliveryRequestedEvent,
  NotificationRequestedEvent,
  ILogger,
} from '@src/common';
import { EmailAdapter, SmsAdapter } from '../../infrastructure/adapters';
import { SendNotificationCommand } from '../commands/send-notification';

@EventsHandler(
  EmailDeliveryRequestedEvent,
  SmsDeliveryRequestedEvent,
  NotificationRequestedEvent,
)
export class OnNotificationRequestedHandler
  implements
    IEventHandler<
      | EmailDeliveryRequestedEvent
      | SmsDeliveryRequestedEvent
      | NotificationRequestedEvent
    >
{
  constructor(
    private readonly commandBus: CommandBus,
    private readonly emailAdapter: EmailAdapter,
    private readonly smsAdapter: SmsAdapter,
    private readonly logger: ILogger,
  ) {}

  async handle(
    event:
      | EmailDeliveryRequestedEvent
      | SmsDeliveryRequestedEvent
      | NotificationRequestedEvent,
  ): Promise<void> {
    try {
      if (event instanceof EmailDeliveryRequestedEvent) {
        await this.emailAdapter.send(event.payload);
      } else if (event instanceof SmsDeliveryRequestedEvent) {
        await this.smsAdapter.send(event.payload);
      } else if (event instanceof NotificationRequestedEvent) {
        await this.commandBus.execute(
          new SendNotificationCommand(event.payload),
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to process notification request event',
        error as Error,
        { eventType: event.constructor.name },
      );
    }
  }
}
