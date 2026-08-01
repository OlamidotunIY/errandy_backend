import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  AcceptApplicationCommand,
  AcceptApplicationPayload,
  MarkApplicationAcceptanceFailedCommand,
} from '../commands';
import {
  ErrorClassification,
  IDeadLetterRepository,
  ILogger,
} from '@src/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  AcceptApplicationErrorClassifier,
  ApplicationInvariantError,
} from '@module/application/domain';

@Processor('accept-application')
export class AcceptApplicationProcessor extends WorkerHost {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly logger: ILogger,
    private readonly errorClassifier: AcceptApplicationErrorClassifier,
    private readonly deadLetterRepository: IDeadLetterRepository,
  ) {
    super();
  }

  async process(job: Job<AcceptApplicationPayload>): Promise<void> {
    const { correlationId, gatewayReference, id } = job.data;

    if (!id || !correlationId) {
      this.logger.error('Missing required fields in job data', {} as Error, {
        jobId: job.id,
        correlationId,
        jobData: job.data,
      });
      throw new ApplicationInvariantError(
        'Missing required fields in job data',
      );
    }

    try {
      if (job.name === 'payment-succeeded') {
        await this.commandBus.execute(
          new AcceptApplicationCommand({
            correlationId,
            gatewayReference,
            id,
          }),
        );
      } else if (job.name === 'payment-failed') {
        await this.commandBus.execute(
          new MarkApplicationAcceptanceFailedCommand({
            applicationId: id,
          }),
        );
      }
    } catch (e) {
      if (
        this.errorClassifier.classify(e as Error) ===
        ErrorClassification.PERMANENT
      ) {
        this.logger.error(
          'Permanent error occurred while continuing accept-application',
          e as Error,
          {
            jobId: job.id,
            correlationId,
            jobData: job.data,
          },
        );
        await this.deadLetterRepository.record({
          payload: { applicationId: id, correlationId, jobName: job.name },
          attemptsMade: job.attemptsMade,
          isPermanent: true,
          queueName: job.name,
          failureReason: (e as Error).message,
        });
        throw e;
      } else {
        this.logger.warn(
          'Transient error occurred while continuing accept-application',
          {
            jobId: job.id,
            correlationId,
            jobData: job.data,
          },
        );
      }
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AcceptApplicationPayload>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.deadLetterRepository.record({
        queueName: job.name,
        payload: {
          applicationId: job.data.id,
          correlationId: job.data.correlationId,
        },
        failureReason: error.message,
        isPermanent: false,
        attemptsMade: job.attemptsMade,
      });
    }
  }
}
