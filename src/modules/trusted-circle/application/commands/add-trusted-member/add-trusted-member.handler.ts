import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AddTrustedMemberCommand } from './add-trusted-member.command';
import { ITrustedCircleRepository, TrustedCircle } from '../../../domain';
import { randomUUID } from 'crypto';

@CommandHandler(AddTrustedMemberCommand)
export class AddTrustedMemberHandler
  implements ICommandHandler<AddTrustedMemberCommand>
{
  constructor(
    private readonly trustedCircleRepository: ITrustedCircleRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AddTrustedMemberCommand): Promise<void> {
    const {
      ownerPartyId,
      memberPartyId,
      status,
      sharedFromPartyId,
      correlationId,
    } = command.payload;

    let circle =
      await this.trustedCircleRepository.findByOwnerPartyId(ownerPartyId);
    if (!circle) {
      circle = TrustedCircle.create(randomUUID(), ownerPartyId);
    }

    circle.addMember(
      memberPartyId,
      status ?? 'CONFIRMED',
      sharedFromPartyId,
      correlationId,
    );
    await this.trustedCircleRepository.save(circle);

    for (const event of circle.pullDomainEvents()) {
      this.eventBus.publish(event);
    }
  }
}
