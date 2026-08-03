import { ChargeSucceededEvent } from '@module/payments';
import { InjectQueue } from '@nestjs/bullmq';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';

@EventsHandler(ChargeSucceededEvent)
export class OnPaymentSucceededHandler implements IEventHandler<ChargeSucceededEvent> {
  constructor(
    @InjectQueue('accept-application')
    private readonly queue: Queue,
  ) {}

  async handle(event: ChargeSucceededEvent): Promise<void> {
    const { purposeId, amountMinorUnits, currency, gatewayReference } = event.payload;

    await this.queue.add('payment-succeeded', {
      purposeId,
      amount: { amountMinorUnits, currency },
      correlationId: event.correlationId,
      gatewayReference,
    });
  }
}
