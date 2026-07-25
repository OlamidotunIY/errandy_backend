import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { CommandBus } from '@nestjs/cqrs';
import { CommandRetryRegistry, EventRetryPayload } from './';
import { IDeadLetterRepository } from '@shared/domain';
import { Job } from 'bullmq';

@Processor('event-retry')
class EventRetryProcessor extends WorkerHost {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly commandRetryRegistry: CommandRetryRegistry,
    private readonly deadLetterRepository: IDeadLetterRepository,
  ) {
    super();
  }

  /**
   * Looks up the command's registration to reconstruct it, then dispatches
   * through the normal CommandBus — same execution path as if the event
   * handler had succeeded on its first attempt.
   */
  async process(job: Job<EventRetryPayload>): Promise<void> {
    const registration = this.commandRetryRegistry.get(
      job.data.commandClassName,
    );
    const command = registration.reconstruct(job.data.commandPayload);
    await this.commandBus.execute(command);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EventRetryPayload>, err: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.deadLetterRepository.record({
        queueName: 'event-retry',
        payload: { ...job.data },
        failureReason: err.message,
        attemptsMade: job.attemptsMade,
        isPermanent: false,
      });
    }
  }
}

export { EventRetryProcessor };
