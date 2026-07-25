import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, tryCatch } from 'bullmq';
import { CommandBus } from '@nestjs/cqrs';
import { ErrorClassification, IDeadLetterRepository, ILogger } from '@shared';
import {
  ReleaseEscrowCommand,
  ReleaseEscrowPayload,
  ReleaseMaturedEscrowsPayload,
} from '@escrow/application';
import { EscrowErrorClassifier, EscrowInvariantError } from '@escrow/domain';

@Processor('release-matured-escrows')
export class ReleaseMaturedEscrowsProcessor extends WorkerHost {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly logger: ILogger,
    private readonly errorClassifier: EscrowErrorClassifier,
    private readonly deadLetterRepository: IDeadLetterRepository,
  ) {
    super();
  }

  async process(job: Job<ReleaseMaturedEscrowsPayload>): Promise<void> {
    const { id, correlationId } = job.data;

    if (!id || !correlationId) {
      this.logger.error('Missing required fields in job data', {} as Error, {
        jobId: job.id,
        correlationId,
        jobData: job.data,
      });
      throw new EscrowInvariantError('Missing required fields in job data');
    }

    try {
      const commandPayload: ReleaseEscrowPayload = {
        escrowId: id,
        correlationId,
      };

      await this.commandBus.execute(new ReleaseEscrowCommand(commandPayload));
    } catch (e) {
      if (this.errorClassifier.classify(e) === ErrorClassification.PERMANENT) {
        this.logger.error(
          'Permanent error occurred while releasing escrow',
          e,
          {
            jobId: job.id,
            correlationId,
            jobData: job.data,
          },
        );
        await this.deadLetterRepository.record({
          payload: {
            escrowId: job.data.id.value,
            correlationId: job.data.correlationId,
          },
          attemptsMade: job.attemptsMade,
          isPermanent: true,
          queueName: job.name,
          failureReason: (e as Error).message,
        });
        throw e;
      } else {
        this.logger.warn('Transient error occurred while releasing escrow', {
          jobId: job.id,
          correlationId,
          jobData: job.data,
        });
      }
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReleaseMaturedEscrowsPayload>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.deadLetterRepository.record({
        queueName: job.name,
        payload: {
          escrowId: job.data.id.value,
          correlationId: job.data.correlationId,
        },
        failureReason: error.message,
        isPermanent: false,
        attemptsMade: job.attemptsMade,
      });
    }
  }
}
