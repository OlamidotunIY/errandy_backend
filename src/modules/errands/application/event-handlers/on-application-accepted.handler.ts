import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { ApplicationAcceptedEvent } from '@module/application/domain';
import {
  ErrandAssignment,
  IErrandRepository,
} from '../../domain';
import { ILogger } from '@src/common';

@EventsHandler(ApplicationAcceptedEvent)
export class OnApplicationAcceptedHandler
  implements IEventHandler<ApplicationAcceptedEvent>
{
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async handle(event: ApplicationAcceptedEvent): Promise<void> {
    const { applicationId, errandId, providerPartyId } = event.payload;

    try {
      const errand = await this.errandRepository.findById(errandId.value);
      if (!errand) {
        this.logger.warn('OnApplicationAcceptedHandler: errand not found', {
          errandId: errandId.value,
        });
        return;
      }

      errand.assignTo(applicationId.value, event.correlationId);
      const assignment = ErrandAssignment.create(
        errand.id,
        providerPartyId.value,
      );

      await this.errandRepository.save(errand);
      await this.errandRepository.saveAssignment(assignment);

      for (const domainEvent of [
        ...errand.pullDomainEvents(),
        ...assignment.pullDomainEvents(),
      ]) {
        this.eventBus.publish(domainEvent);
      }

      this.logger.info('Errand assigned upon application acceptance event', {
        errandId: errandId.value,
        applicationId: applicationId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle ApplicationAcceptedEvent in ErrandsModule',
        error as Error,
        {
          errandId: errandId.value,
          applicationId: applicationId.value,
        },
      );
    }
  }
}
