import { EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AcceptApplicationCommand } from './';
import {
  AcceptApplicationProgressStatus,
  ApplicationInvariantError,
  IAcceptApplicationProgressRepository,
  IApplicationRepository,
} from '@module/application';
import { ILogger } from '@src/common';

export class AcceptApplicationHandler implements ICommandHandler<AcceptApplicationCommand> {
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly progressRepo: IAcceptApplicationProgressRepository,
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
      // todo: call asign errand command, mark progress asigned and save progress
    }

    if (progress.status() === AcceptApplicationProgressStatus.ASSIGNED) {
      //todo: create escrow command, make progress complete and save progress
    }

    this.logger.info('Application accepted', { applicationId: id });
  }
}
