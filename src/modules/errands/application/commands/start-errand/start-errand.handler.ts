import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { StartErrandCommand, StartErrandResponseDto } from '.';
import {
  ErrandInvariantError,
  ErrandNotFoundError,
  IErrandRepository,
} from '@module/errands/domain';
import { ILogger } from '@src/common';

@CommandHandler(StartErrandCommand)
export class StartErrandHandler implements ICommandHandler<StartErrandCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: StartErrandCommand): Promise<StartErrandResponseDto> {
    const { errandId, profileId } = command.payload;

    const errand = await this.errandRepository.findById(errandId);
    if (!errand) {
      throw new ErrandNotFoundError(errandId);
    }

    const assignments =
      await this.errandRepository.findAssignmentsByErrandId(errandId);
    const isAssignedMember = assignments.some((a) => a.profileId === profileId);
    if (!isAssignedMember) {
      throw new ErrandInvariantError(
        'Only an assigned member may start this errand',
      );
    }

    errand.start();
    await this.errandRepository.save(errand);

    for (const event of errand.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Errand started', { errandId });

    return { errandId, status: errand.status };
  }
}
