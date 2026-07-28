import { EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AcceptApplicationCommand } from '@application/application';
import {
  ApplicationInvariantError,
  IApplicationRepository,
} from '@application/domain';
import { ILogger } from '@shared';

export class AcceptApplicationHandler implements ICommandHandler<AcceptApplicationCommand> {
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly event: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: AcceptApplicationCommand): Promise<void> {
    const { id } = command.payload;

    if (!id) {
      throw new ApplicationInvariantError('ApplicationId must be provided');
    }

    const application = await this.repository.findById(id);

    if (!application) {
      throw new ApplicationInvariantError('Application not found');
    }

    application.accept();

    await this.repository.save(application);

    // Publish domain events
    const events = application.pullDomainEvents();
    for (const event of events) {
      this.event.publish(event);
    }
  }
}
