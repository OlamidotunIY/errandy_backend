import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { VerificationCompletedEvent } from '@module/verification';
import { ILogger } from '@src/common';

@EventsHandler(VerificationCompletedEvent)
export class OnVerificationCompletedHandler implements IEventHandler<VerificationCompletedEvent> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async handle(event: VerificationCompletedEvent): Promise<void> {
    const { partyId, tier } = event.payload;

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    party.providerRole.recordVerificationCompleted(tier);
    await this.partyRepository.save(party);

    for (const domainEvent of party.pullDomainEvents()) {
      this.eventBus.publish(domainEvent);
    }

    this.logger.info('Verification completed handled', { partyId });
  }
}
