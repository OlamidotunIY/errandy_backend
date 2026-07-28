import { EventBus, ICommandHandler } from '@nestjs/cqrs';
import { RejectOtherApplicationsCommand } from '@application/application';
import {
  ApplicationInvariantError,
  IApplicationRepository,
} from '@application/domain';
import { ILogger } from '@shared';

export class RejectOtherApplicationsHandler implements ICommandHandler<RejectOtherApplicationsCommand> {
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly event: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: RejectOtherApplicationsCommand): Promise<void> {
    const { errandId, acceptedApplicationId, correlationId } = command.payload;

    if (!errandId && acceptedApplicationId && correlationId) {
      this.logger.error(
        'errandId, acceptedApplicationId and correlationId are all required fields',
      );
      throw new ApplicationInvariantError(
        `errandId, acceptedApplicationId and correlationId are all required fields`,
      );
    }

    //ToDo confirm errand exist

    const otherApplications =
      await this.repository.findPendingByErrandId(errandId);

    for (const otherApplication of otherApplications) {
      if (otherApplication.id == acceptedApplicationId) {
        this.logger.warn(
          'trying to reject the accepted application is not possible',
          {
            acceptedApplicationId: acceptedApplicationId,
            rejectingApplicationId: otherApplication.id,
          },
        );
      }
      if (otherApplication.canBeRejected()) {
        otherApplication.reject(correlationId);
        await this.repository.save(otherApplication);
      } else {
        if (otherApplication.isRejected()) {
          this.logger.info(`Application is already rejected`, {
            applicationId: otherApplication.id,
          });
        } else {
          this.logger.info(`Application cannot be rejected`, {
            applicationId: otherApplication.id,
          });
        }
      }

      const events = otherApplication.pullDomainEvents();
      for (const event of events) {
        this.event.publish(event);
      }
    }
  }
}
