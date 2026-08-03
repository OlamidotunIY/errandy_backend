import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  UpdateAssignmentConfirmationCommand,
  UpdateAssignmentConfirmationResponseDto,
} from '.';
import {
  ErrandInvariantError,
  ErrandNotFoundError,
  ErrandStatus,
  IErrandRepository,
} from '@module/errands/domain';
import { ILogger } from '@src/common';

@CommandHandler(UpdateAssignmentConfirmationCommand)
export class UpdateAssignmentConfirmationHandler implements ICommandHandler<UpdateAssignmentConfirmationCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: UpdateAssignmentConfirmationCommand,
  ): Promise<UpdateAssignmentConfirmationResponseDto> {
    const { errandAssignmentId, providerPartyId, proofUrl } = command.payload;

    const assignment =
      await this.errandRepository.findAssignmentById(errandAssignmentId);
    if (!assignment) {
      throw new ErrandInvariantError('Errand assignment not found');
    }

    const errand = await this.errandRepository.findById(
      assignment.errandId.value,
    );
    if (!errand) {
      throw new ErrandNotFoundError(assignment.errandId.value);
    }

    assignment.updateConfirmation(
      providerPartyId,
      proofUrl,
      errand.status === ErrandStatus.COMPLETED,
      crypto.randomUUID(),
    );
    await this.errandRepository.saveAssignment(assignment);

    for (const event of assignment.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Assignment confirmation updated', {
      errandAssignmentId,
    });

    return { errandAssignmentId: assignment.id.value, proofUrl };
  }
}
