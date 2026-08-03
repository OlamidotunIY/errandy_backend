import { ChargeFailedEvent } from '@module/payments';
import { InjectQueue } from '@nestjs/bullmq';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';

@EventsHandler(ChargeFailedEvent)
export class OnPaymentFailedHandler implements IEventHandler<ChargeFailedEvent> {
  constructor(
    @InjectQueue('accept-application')
    private readonly queue: Queue,
  ) {}

  async handle(event: ChargeFailedEvent): Promise<void> {
    const { purposeId, reason } = event.payload;

    await this.queue.add('payment-failed', {
      correlationId: event.correlationId,
      gatewayReference: undefined,
      id: purposeId,
      reason,
    });
  }
}
