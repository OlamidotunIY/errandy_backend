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
    await this.queue.add('payment-succeeded', {
      correlationId: event.correlationId,
      gatewayReference: event.gatewayReference,
      id: event.purposeId,
    });
  }
}
