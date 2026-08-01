import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  DeactivatePartyCommand,
  DeactivatePartyResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(DeactivatePartyCommand)
export class DeactivatePartyHandler implements ICommandHandler<DeactivatePartyCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: DeactivatePartyCommand,
  ): Promise<DeactivatePartyResponseDto> {
    const { partyId } = command.payload;

    if (!partyId) {
      throw new PartyInvariantError('partyId is required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    try {
      party.deactivate();
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Party deactivated', { partyId });

      return { partyId, isActive: party.isActive };
    } catch (error) {
      this.logger.error('Failed to deactivate party', error as Error, {
        partyId,
      });
      throw error;
    }
  }
}
