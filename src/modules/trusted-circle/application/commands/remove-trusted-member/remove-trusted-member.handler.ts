import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { RemoveTrustedMemberCommand } from './remove-trusted-member.command';
import { ITrustedCircleRepository } from '../../../domain';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(RemoveTrustedMemberCommand)
export class RemoveTrustedMemberHandler
  implements ICommandHandler<RemoveTrustedMemberCommand>
{
  constructor(
    private readonly trustedCircleRepository: ITrustedCircleRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RemoveTrustedMemberCommand): Promise<void> {
    const { ownerPartyId, memberPartyId, correlationId } = command.payload;

    const circle =
      await this.trustedCircleRepository.findByOwnerPartyId(ownerPartyId);
    if (!circle) {
      throw new NotFoundException('Trusted circle not found');
    }

    circle.removeMember(memberPartyId, correlationId);
    await this.trustedCircleRepository.save(circle);

    for (const event of circle.pullDomainEvents()) {
      this.eventBus.publish(event);
    }
  }
}
