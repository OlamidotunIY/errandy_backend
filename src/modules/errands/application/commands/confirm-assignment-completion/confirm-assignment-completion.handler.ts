import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';
import {
  ConfirmAssignmentCompletionCommand,
  ConfirmAssignmentCompletionResponseDto,
} from '.';
import {
  ErrandInvariantError,
  ErrandNotFoundError,
  ErrandReadyForCompletionEvent,
  IErrandRepository,
} from '@module/errands/domain';
import { ILogger } from '@src/common';
import { AutoAcceptErrandPayload } from '../../jobs/AutoAcceptErrandPayload';

@CommandHandler(ConfirmAssignmentCompletionCommand)
export class ConfirmAssignmentCompletionHandler implements ICommandHandler<ConfirmAssignmentCompletionCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
    @InjectQueue('auto-accept-errand')
    private readonly autoAcceptQueue: Queue<AutoAcceptErrandPayload>,
  ) {}

  async execute(
    command: ConfirmAssignmentCompletionCommand,
  ): Promise<ConfirmAssignmentCompletionResponseDto> {
    const { errandAssignmentId, profileId, proofUrl } = command.payload;

    const assignment =
      await this.errandRepository.findAssignmentById(errandAssignmentId);
    if (!assignment) {
      throw new ErrandInvariantError('Errand assignment not found');
    }

    const correlationId = crypto.randomUUID();
    assignment.confirmDone(profileId, proofUrl, correlationId);
    await this.errandRepository.saveAssignment(assignment);

    for (const event of assignment.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    const errand = await this.errandRepository.findById(
      assignment.errandId.value,
    );
    if (!errand) {
      throw new ErrandNotFoundError(assignment.errandId.value);
    }

    const allAssignments =
      await this.errandRepository.findAssignmentsByErrandId(
        assignment.errandId.value,
      );
    const allConfirmed = errand.allAssignmentsConfirmed(allAssignments);

    if (allConfirmed) {
      this.eventBus.publish(
        new ErrandReadyForCompletionEvent(errand.id, correlationId, {
          errandId: errand.id.value,
        }),
      );

      await this.autoAcceptQueue.add(
        'auto-accept-errand',
        { errandId: errand.id.value, correlationId },
        {
          jobId: errand.id.value,
          delay: 24 * 60 * 60 * 1000,
        },
      );

      this.logger.info('Errand ready for completion, auto-accept scheduled', {
        errandId: errand.id.value,
      });
    }

    return {
      errandAssignmentId: assignment.id.value,
      status: assignment.status,
      errandReadyForCompletion: allConfirmed,
    };
  }
}
