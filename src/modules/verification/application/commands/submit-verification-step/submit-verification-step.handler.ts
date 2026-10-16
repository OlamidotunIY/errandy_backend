import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { SubmitVerificationStepCommand } from './submit-verification-step.command';
import { IVerificationRepository, VerificationProfile } from '../../../domain';
import { randomUUID } from 'crypto';

@CommandHandler(SubmitVerificationStepCommand)
export class SubmitVerificationStepHandler
  implements ICommandHandler<SubmitVerificationStepCommand>
{
  constructor(
    private readonly verificationRepository: IVerificationRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SubmitVerificationStepCommand): Promise<void> {
    const { partyId, stepType, documentUrls } = command.payload;

    let profile = await this.verificationRepository.findByPartyId(partyId);
    if (!profile) {
      profile = VerificationProfile.create(randomUUID(), partyId);
    }

    profile.submitStep(stepType, documentUrls);
    await this.verificationRepository.save(profile);

    for (const event of profile.pullDomainEvents()) {
      this.eventBus.publish(event);
    }
  }
}
