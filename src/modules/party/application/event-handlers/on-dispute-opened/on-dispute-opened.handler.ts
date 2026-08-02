import { DisputeOpenedEvent } from '@module/dispute';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@EventsHandler(DisputeOpenedEvent)
export class OnDisputeOpenedHandler implements IEventHandler<DisputeOpenedEvent> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async handle(event: DisputeOpenedEvent): Promise<void> {
    const { partyId } = event.payload;

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    party.providerRole.incrementDisputedErrandsCount();
    await this.partyRepository.save(party);

    for (const domainEvent of party.pullDomainEvents()) {
      this.eventBus.publish(domainEvent);
    }

    this.logger.info('Dispute opened handled for party', { partyId });
  }
}
