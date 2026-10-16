import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ResolveDisputeCommand } from './resolve-dispute.command';
import { IDisputeRepository } from '../../../domain';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(ResolveDisputeCommand)
export class ResolveDisputeHandler
  implements ICommandHandler<ResolveDisputeCommand>
{
  constructor(
    private readonly disputeRepository: IDisputeRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ResolveDisputeCommand): Promise<void> {
    const { disputeId, status, resolution, adminUserId } = command.payload;

    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    if (status === 'RESOLVED') {
      dispute.resolve(resolution, adminUserId);
    } else {
      dispute.reject(resolution, adminUserId);
    }

    await this.disputeRepository.save(dispute);

    for (const event of dispute.pullDomainEvents()) {
      this.eventBus.publish(event);
    }
  }
}
