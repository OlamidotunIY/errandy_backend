import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { SubmitApplicationCommand } from './';
import {
  Application,
  ApplicationId,
  ApplicationInvariantError,
  DuplicateApplicationError,
  IApplicationRepository,
} from '@module/application';
import { ILogger } from '@src/common';

@CommandHandler(SubmitApplicationCommand)
class SubmitApplicationHandler implements ICommandHandler<SubmitApplicationCommand> {
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly event: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: SubmitApplicationCommand): Promise<ApplicationId> {
    const {
      errandId,
      providerPartyId,
      proposedAmountMinorUnits,
      proposal,
      currency,
      applicantType,
    } = command.payload;

    if (!errandId && !providerPartyId) {
      throw new ApplicationInvariantError(
        'ErrandId and ProviderId must be provided',
      );
    }

    const application = await this.repository.existsByErrandAndWorker(
      errandId,
      providerPartyId,
    );

    if (application) {
      throw new DuplicateApplicationError(errandId.value, providerPartyId.value);
    }

    const newApplication = Application.create(
      errandId,
      providerPartyId,
      proposal,
      proposedAmountMinorUnits,
      currency,
      applicantType,
    );

    await this.repository.save(newApplication);

    // Publish domain events
    const events = newApplication.pullDomainEvents();
    for (const event of events) {
      this.event.publish(event);
    }

    this.logger.info(
      `Application ${newApplication.id.value} submitted successfully`,
    );
    return newApplication.id;
  }
}
