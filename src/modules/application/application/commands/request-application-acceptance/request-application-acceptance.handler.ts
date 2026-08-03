import {
  CommandBus,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from '@nestjs/cqrs';
import {
  AcceptApplicationProgress,
  ApplicationInvariantError,
  IAcceptApplicationProgressRepository,
  IApplicationRepository,
  InitiateChargeCommand,
  RequestApplicationAcceptanceCommand,
} from '@src/modules';
import { IErrandRepository, ErrandNotFoundError } from '@module/errands/domain';
import { ILogger } from '@src/common';

@CommandHandler(RequestApplicationAcceptanceCommand)
export class RequestApplicationAcceptanceHandler implements ICommandHandler<RequestApplicationAcceptanceCommand> {
  constructor(
    private readonly progressRepo: IAcceptApplicationProgressRepository,
    private readonly applicationRepo: IApplicationRepository,
    private readonly errandRepository: IErrandRepository,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: RequestApplicationAcceptanceCommand): Promise<void> {
    const { applicationId, clientPartyId, paymentMethodId } = command.payload;

    const application = await this.applicationRepo.findById(applicationId);

    if (!application?.canBeAccepted()) {
      throw new ApplicationInvariantError('Application cannot be accepted');
    }

    // Verify the errand belongs to the requesting client
    const errand = await this.errandRepository.findById(
      application.errandId.value,
    );

    if (!errand) {
      throw new ErrandNotFoundError(application.errandId.value);
    }

    if (errand.clientPartyId !== clientPartyId.value) {
      throw new ApplicationInvariantError(
        'Only the errand owner can accept applications',
      );
    }

    // Create acceptance progress tracker
    const progress = AcceptApplicationProgress.create(
      application.id,
      application.errandId,
    );
    await this.progressRepo.save(progress);

    // Initiate charge against the client's payment method
    try {
      const chargeResult = await this.commandBus.execute(
        new InitiateChargeCommand({
          clientPartyId: clientPartyId.value,
          purposeId: application.errandId.value,
          amount: application.proposedAmountMinorUnits(),
          paymentMethodId,
        }),
      );

      progress.recordGatewayReference(chargeResult.gatewayReference);
      await this.progressRepo.save(progress);

      this.logger.info('Charge initiated for application acceptance', {
        applicationId: applicationId.value,
        gatewayReference: chargeResult.gatewayReference,
      });
    } catch (error) {
      progress.markFailed();
      await this.progressRepo.save(progress);

      this.logger.error(
        'Charge failed during application acceptance',
        {} as Error,
        {
          applicationId: applicationId.value,
          error,
        },
      );

      throw error;
    }

    // Publish domain events
    const domainEvents = progress.pullDomainEvents();
    for (const event of domainEvents) {
      this.eventBus.publish(event);
    }
  }
}
