import { ErrandCompletedEvent } from '@module/errand';
import { MarkEscrowCompletedCommand } from '@module/escrow';
import {
  EscrowErrorClassifier,
  EscrowId,
  EscrowInvariantError,
} from '@module/escrow/domain';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  ErrorClassification,
  EventRetryQueueService,
  IDeadLetterRepository,
  ILogger,
} from '@src/common';

@EventsHandler(ErrandCompletedEvent)
export class OnErrandCompletedMarkEscrow implements IEventHandler<ErrandCompletedEvent> {
  constructor(
    private readonly logger: ILogger,
    private readonly command: CommandBus,
    private readonly errorClassifier: EscrowErrorClassifier,
    private readonly eventRetryQueue: EventRetryQueueService,
    private readonly deadLetterRepository: IDeadLetterRepository,
  ) {}

  async handle(event: ErrandCompletedEvent): Promise<void> {
    const { payload, eventId, correlationId } = event;

    if (!eventId) {
      this.logger.error('Event ID is missing');
      throw new EscrowInvariantError('Event ID is missing');
    }

    try {
      await this.command.execute(
        new MarkEscrowCompletedCommand({
          escrowId: EscrowId.fromString(payload.escrowId as string),
          correlationId: correlationId,
          completedAt: payload.CompletedAt as Date,
        }),
      );
    } catch (error) {
      if (
        this.errorClassifier.classify(error) === ErrorClassification.PERMANENT
      ) {
        this.logger.error(
          'Permanent failure marking escrow completed — not retrying',
          error as Error,
          { correlationId },
        );

        await this.deadLetterRepository.record({
          queueName: 'event-retry',
          payload: {
            commandClassName: 'MarkEscrowCompletedCommand',
            payload,
            correlationId,
            originatingEventId: eventId,
          },
          failureReason: (error as Error).message,
          attemptsMade: 0,
          isPermanent: true,
        });
        return;
      }
    }

    await this.eventRetryQueue.enqueueRetry({
      commandClassName: 'MarkEscrowCompletedCommand',
      commandPayload: payload,
      correlationId,
      originatingEventId: eventId,
    });
  }
}
