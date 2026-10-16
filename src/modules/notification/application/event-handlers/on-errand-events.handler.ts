import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ErrandStartedEvent, ErrandCompletedEvent } from '@module/errands';
import { ILogger } from '@src/common';

@EventsHandler(ErrandStartedEvent, ErrandCompletedEvent)
export class OnErrandEventsHandler
  implements IEventHandler<ErrandStartedEvent | ErrandCompletedEvent>
{
  constructor(private readonly logger: ILogger) {}

  async handle(event: ErrandStartedEvent | ErrandCompletedEvent): Promise<void> {
    try {
      this.logger.info(`Errand event notification handled: ${event.eventName}`, {
        errandId: event.aggregateId.value,
      });
    } catch (err) {
      this.logger.error(
        'Failed to handle errand notification event',
        err as Error,
      );
    }
  }
}
