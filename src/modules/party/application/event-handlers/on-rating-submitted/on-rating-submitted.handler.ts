import { RatingSubmittedEvent } from '@module/rating';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@EventsHandler(RatingSubmittedEvent)
export class OnRatingSubmittedHandler implements IEventHandler<RatingSubmittedEvent> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async handle(event: RatingSubmittedEvent): Promise<void> {
    const { partyId, rating, source } = event.payload;

    if (source && source !== 'CLIENT_FACING') {
      return;
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    party.providerRole.recomputeAvgRating(rating);
    await this.partyRepository.save(party);

    for (const domainEvent of party.pullDomainEvents()) {
      this.eventBus.publish(domainEvent);
    }

    this.logger.info('Rating submitted handled for provider', { partyId });
  }
}
