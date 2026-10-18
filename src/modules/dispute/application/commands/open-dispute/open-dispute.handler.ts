import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { OpenDisputeCommand } from './open-dispute.command';
import { Dispute, IDisputeRepository } from '../../../domain';
import { randomUUID } from 'crypto';

@CommandHandler(OpenDisputeCommand)
export class OpenDisputeHandler
  implements ICommandHandler<OpenDisputeCommand, string>
{
  constructor(
    private readonly disputeRepository: IDisputeRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: OpenDisputeCommand): Promise<string> {
    const {
      errandId,
      raisedById,
      providerPartyId,
      reason,
      description,
      evidenceUrls,
      correlationId,
    } = command.payload;
    const id = randomUUID();

    const dispute = Dispute.open(
      id,
      errandId,
      raisedById,
      providerPartyId,
      reason,
      description,
      evidenceUrls ?? [],
      correlationId,
    );

    await this.disputeRepository.save(dispute);

    for (const event of dispute.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    return id;
  }
}
