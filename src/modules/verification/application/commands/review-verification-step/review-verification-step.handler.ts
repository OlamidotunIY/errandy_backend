import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ReviewVerificationStepCommand } from './review-verification-step.command';
import { IVerificationRepository } from '../../../domain';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(ReviewVerificationStepCommand)
export class ReviewVerificationStepHandler
  implements ICommandHandler<ReviewVerificationStepCommand>
{
  constructor(
    private readonly verificationRepository: IVerificationRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReviewVerificationStepCommand): Promise<void> {
    const { partyId, stepType, status, reviewerId, rejectionReason, correlationId } =
      command.payload;

    const profile = await this.verificationRepository.findByPartyId(partyId);
    if (!profile) {
      throw new NotFoundException(`Verification profile for party ${partyId} not found`);
    }

    profile.reviewStep(stepType, status, reviewerId, rejectionReason, correlationId);
    await this.verificationRepository.save(profile);

    for (const event of profile.pullDomainEvents()) {
      this.eventBus.publish(event);
    }
  }
}
