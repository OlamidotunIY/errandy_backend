import { EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AcceptApplicationCommand } from './';
import {
  AcceptApplicationProgressStatus,
  ApplicationInvariantError,
  IAcceptApplicationProgressRepository,
  IApplicationRepository,
} from '@module/application';
import { IErrandRepository } from '@module/errands/domain';
import { ILogger } from '@src/common';

export class AcceptApplicationHandler implements ICommandHandler<AcceptApplicationCommand> {
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly progressRepo: IAcceptApplicationProgressRepository,
    private readonly errandRepository: IErrandRepository,
    private readonly event: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: AcceptApplicationCommand): Promise<void> {
    const { id, correlationId, gatewayReference } = command.payload;

    if (!id) {
      throw new ApplicationInvariantError('ApplicationId must be provided');
    }

    const progress = await this.progressRepo.findByApplicationId(id);

    if (!progress) {
      throw new ApplicationInvariantError(
        'Application progress does not exist',
      );
    }

    if (
      progress.status() === AcceptApplicationProgressStatus.CHARGE_INITIATED
    ) {
      progress.recordGatewayReference(gatewayReference);

      const application = await this.repository.findById(id);

      if (!application) {
        throw new ApplicationInvariantError('Application not found');
      }

      application.accept();

      await this.repository.save(application);
      progress.markAccepted();
      await this.progressRepo.save(progress);

      // Publish domain events
      const events = application.pullDomainEvents();
      for (const event of events) {
        this.event.publish(event);
      }
    }

    if (progress.status() === AcceptApplicationProgressStatus.ACCEPTED) {
      const application = await this.repository.findById(id);

      if (!application) {
        throw new ApplicationInvariantError('Application not found');
      }

      const errand = await this.errandRepository.findById(
        application.errandId.value,
      );

      if (!errand) {
        throw new ApplicationInvariantError(
          `Errand not found for application ${id.value}`,
        );
      }

      errand.assignTo(application.id.value, correlationId);

      await this.errandRepository.save(errand);
      progress.markErrandAssigned();
      await this.progressRepo.save(progress);

      // Publish ErrandAssignedEvent (opens chat thread, etc.)
      const errandEvents = errand.pullDomainEvents();
      for (const event of errandEvents) {
        this.event.publish(event);
      }
    }

    if (progress.status() === AcceptApplicationProgressStatus.ASSIGNED) {
      //todo: create escrow command, make progress complete and save progress
    }

    this.logger.info('Application accepted', { applicationId: id });
  }
}
