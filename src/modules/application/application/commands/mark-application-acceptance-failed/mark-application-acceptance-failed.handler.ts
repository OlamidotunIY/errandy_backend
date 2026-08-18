import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarkApplicationAcceptanceFailedCommand } from './';
import { IAcceptApplicationProgressRepository } from '@src/modules';

@CommandHandler(MarkApplicationAcceptanceFailedCommand)
export class MarkApplicationAcceptanceFailedHandler implements ICommandHandler<MarkApplicationAcceptanceFailedCommand> {
  constructor(
    private readonly progressRepo: IAcceptApplicationProgressRepository,
  ) {}

  async execute(
    command: MarkApplicationAcceptanceFailedCommand,
  ): Promise<void> {
    const { applicationId } = command.payload;

    const progress = await this.progressRepo.findByApplicationId(applicationId);

    if (!progress) return;
    progress.markFailed();
    await this.progressRepo.save(progress);
  }
}
