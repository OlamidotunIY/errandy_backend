import { PaymentFailed } from '@module/payments';
import { InjectQueue } from '@nestjs/bullmq';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';

@EventsHandler(PaymentFailed)
export class OnPaymentFailedHandler implements IEventHandler<PaymentFailed> {
  constructor(
    @InjectQueue('accept-application')
    private readonly queue: Queue,
  ) {}

  async handle(event: PaymentFailed): Promise<void> {
    const { gatewayReference, purposeId, reason } = event.payload;

    await this.queue.add('payment-failed', {
      correlationId: event.correlationId,
      gatewayReference,
      id: purposeId,
      reason,
    });
  }
}
