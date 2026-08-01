import { ApplicationAcceptedEvent } from '@module/application';
import { InjectQueue } from '@nestjs/bullmq';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';
import { ProfileRatingRecalcPayload } from '@module/party';

@EventsHandler(ApplicationAcceptedEvent)
export class OnApplicationAcceptedHandler implements IEventHandler<ApplicationAcceptedEvent> {
  constructor(
    @InjectQueue('party-profile-rating-recalc')
    private readonly profileRatingRecalcQueue: Queue<ProfileRatingRecalcPayload>,
  ) {}

  async handle(event: ApplicationAcceptedEvent): Promise<void> {
    const workerPartyId = event.payload.workerId.value;

    await this.profileRatingRecalcQueue.add('profile-rating-recalc', {
      partyId: workerPartyId,
      avgRating: 0,
    });
  }
}
