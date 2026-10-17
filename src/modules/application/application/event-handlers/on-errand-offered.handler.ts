import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import {
  ErrandOfferedToTrustedMemberIntegrationEvent,
  ErrandDirectlyAssignedIntegrationEvent,
  ILogger,
} from '@src/common';
import {
  Application,
  ApplicationId,
  ApplicationType,
  IApplicationRepository,
} from '../../domain';
import { ErrandId } from '@module/errands/domain';
import { PartyId } from '@module/party/domain';

@EventsHandler(
  ErrandOfferedToTrustedMemberIntegrationEvent,
  ErrandDirectlyAssignedIntegrationEvent,
)
export class OnErrandOfferedHandler
  implements
    IEventHandler<
      | ErrandOfferedToTrustedMemberIntegrationEvent
      | ErrandDirectlyAssignedIntegrationEvent
    >
{
  constructor(
    private readonly applicationRepo: IApplicationRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async handle(
    event:
      | ErrandOfferedToTrustedMemberIntegrationEvent
      | ErrandDirectlyAssignedIntegrationEvent,
  ): Promise<void> {
    const {
      applicationId,
      errandId,
      offeredToPartyId,
      proposedAmountMinorUnits,
      currency,
    } = event.payload;

    try {
      const application = Application.create(
        ErrandId.fromString(errandId),
        PartyId.fromString(offeredToPartyId),
        'Direct trusted offer',
        proposedAmountMinorUnits,
        currency,
        ApplicationType.DIRECT_OFFER,
        ApplicationId.fromString(applicationId),
      );

      await this.applicationRepo.save(application);

      for (const domainEvent of application.pullDomainEvents()) {
        this.eventBus.publish(domainEvent);
      }

      this.logger.info('Application created from direct errand offer event', {
        applicationId,
        errandId,
      });
    } catch (error) {
      this.logger.error(
        'Failed to create application from direct offer event',
        error as Error,
        { applicationId, errandId },
      );
    }
  }
}
