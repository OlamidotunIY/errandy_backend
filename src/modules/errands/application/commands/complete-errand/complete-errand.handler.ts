import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';
import { CompleteErrandCommand, CompleteErrandResponseDto } from '.';
import {
  CompletedBy,
  ErrandNotFoundError,
  IErrandRepository,
} from '@module/errands/domain';
import { ILogger } from '@src/common';
import { AutoAcceptErrandPayload } from '../../jobs/auto-accept-errand.payload';

@CommandHandler(CompleteErrandCommand)
export class CompleteErrandHandler implements ICommandHandler<CompleteErrandCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
    @InjectQueue('auto-accept-errand')
    private readonly autoAcceptQueue: Queue<AutoAcceptErrandPayload>,
  ) {}

  async execute(
    command: CompleteErrandCommand,
  ): Promise<CompleteErrandResponseDto> {
    const { errandId, completedBy } = command.payload;

    const errand = await this.errandRepository.findById(errandId);
    if (!errand) {
      throw new ErrandNotFoundError(errandId);
    }

    const assignments =
      await this.errandRepository.findAssignmentsByErrandId(errandId);

    errand.complete(
      completedBy as CompletedBy,
      assignments,
      crypto.randomUUID(),
    );
    await this.errandRepository.save(errand);

    const job = await this.autoAcceptQueue.getJob(errandId);
    if (job) {
      await job.remove();
    }

    for (const event of errand.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Errand completed', { errandId, completedBy });

    return { errandId, status: errand.status };
  }
}
