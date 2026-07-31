import { PaymentSucceeded } from '@module/payments';
import { InjectQueue } from '@nestjs/bullmq';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';

@EventsHandler(PaymentSucceeded)
export class OnPaymentSucceededHandler implements IEventHandler<PaymentSucceeded> {
  constructor(
    @InjectQueue('accept-application')
    private readonly queue: Queue,
  ) {}

  async handle(event: PaymentSucceeded): Promise<void> {
    const { purposeId, amountKobo, correlationId, gatewayReference } = event;

    await this.queue.add('payment-succeeded', {
      purposeId,
      amountKobo,
      correlationId,
      gatewayReference,
    });
  }
}
