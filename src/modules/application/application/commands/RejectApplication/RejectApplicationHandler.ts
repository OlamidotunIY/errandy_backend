import { EventBus, ICommandHandler } from '@nestjs/cqrs';
import { RejectApplicationCommand } from './';
import { IApplicationRepository } from '@module/application/domain';
import { ILogger } from '@src/common';

export class RejectApplicationHandler implements ICommandHandler<RejectApplicationCommand> {
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly event: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: RejectApplicationCommand): Promise<void> {
    const { id } = command.payload;

    if (!id) {
      throw new Error('ApplicationId must be provided');
    }

    const application = await this.repository.findById(id);

    if (!application) {
      throw new Error('Application not found');
    }

    application.reject();

    await this.repository.save(application);

    // Publish domain events
    const events = application.pullDomainEvents();
    for (const event of events) {
      this.event.publish(event);
    }

    this.logger.info('Application rejected', { applicationId: id });
  }
}
