import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { ChargeSucceededEvent, ChargeFailedEvent } from '@module/payments';
import { IPartyRepository } from '@module/party';
import { SendNotificationCommand } from '../commands/send-notification';
import { ILogger } from '@src/common';

@EventsHandler(ChargeSucceededEvent, ChargeFailedEvent)
export class OnPaymentEventsHandler
  implements IEventHandler<ChargeSucceededEvent | ChargeFailedEvent>
{
  constructor(
    private readonly commandBus: CommandBus,
    private readonly partyRepository: IPartyRepository,
    private readonly logger: ILogger,
  ) {}

  async handle(event: ChargeSucceededEvent | ChargeFailedEvent): Promise<void> {
    try {
      if (event instanceof ChargeSucceededEvent) {
        const party = await this.partyRepository.findById(event.payload.partyId);
        const userId = party?.person?.userId.value ?? event.payload.partyId;

        await this.commandBus.execute(
          new SendNotificationCommand({
            userId,
            type: 'PAYMENT_SUCCESS',
            channel: 'EMAIL',
            payload: {
              subject: 'Payment Successful',
              reference: event.payload.gatewayReference,
              amount: event.payload.amountMinorUnits,
              currency: event.payload.currency,
            },
          }),
        );
      } else if (event instanceof ChargeFailedEvent) {
        const party = await this.partyRepository.findById(event.payload.partyId);
        const userId = party?.person?.userId.value ?? event.payload.partyId;

        await this.commandBus.execute(
          new SendNotificationCommand({
            userId,
            type: 'PAYMENT_FAILED',
            channel: 'EMAIL',
            payload: {
              subject: 'Payment Failed',
              reason: event.payload.reason,
            },
          }),
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to handle payment notification event',
        err as Error,
      );
    }
  }
}
