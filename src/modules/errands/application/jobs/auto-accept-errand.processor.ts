import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CommandBus } from '@nestjs/cqrs';
import { ILogger } from '@src/common';
import { IErrandRepository, ErrandStatus } from '@module/errands/domain';
import { CompleteErrandCommand } from '../commands';
import { AutoAcceptErrandPayload } from './auto-accept-errand.payload';

@Processor('auto-accept-errand')
export class AutoAcceptErrandProcessor extends WorkerHost {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly errandRepository: IErrandRepository,
    private readonly logger: ILogger,
  ) {
    super();
  }

  async process(job: Job<AutoAcceptErrandPayload>): Promise<void> {
    const { errandId } = job.data;

    const errand = await this.errandRepository.findById(errandId);
    if (!errand) {
      this.logger.warn('Auto-accept: errand no longer exists', { errandId });
      return;
    }

    if (errand.status === ErrandStatus.COMPLETED) {
      this.logger.info('Auto-accept: errand already completed, no-op', {
        errandId,
      });
      return;
    }

    await this.commandBus.execute(
      new CompleteErrandCommand({ errandId, completedBy: 'SYSTEM' }),
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AutoAcceptErrandPayload>, error: Error): void {
    this.logger.error('Auto-accept errand job failed', error, {
      jobId: job.id,
      errandId: job.data.errandId,
    });
  }
}
