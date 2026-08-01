import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  AcceptApplicationProgress,
  ApplicationInvariantError,
  IAcceptApplicationProgressRepository,
  IApplicationRepository,
  RequestApplicationAcceptanceCommand,
} from '@src/modules';

@CommandHandler(RequestApplicationAcceptanceCommand)
export class RequestApplicationAcceptanceHandler implements ICommandHandler<RequestApplicationAcceptanceCommand> {
  constructor(
    private readonly progressRepo: IAcceptApplicationProgressRepository,
    private readonly applicationRepo: IApplicationRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RequestApplicationAcceptanceCommand): Promise<void> {
    const { applicationId, clientId } = command.payload;

    const application = await this.applicationRepo.findById(applicationId);

    if (!application?.canBeAccepted()) {
      throw new ApplicationInvariantError('Application cannot be accepted');
    }

    const progress = AcceptApplicationProgress.create(
      application.id,
      application.errandId,
    );
    await this.progressRepo.save(progress);

    //todo initial charge
  }
}
