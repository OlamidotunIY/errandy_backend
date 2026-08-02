import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  RequestTierUpgradeCommand,
  RequestTierUpgradeResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(RequestTierUpgradeCommand)
export class RequestTierUpgradeHandler implements ICommandHandler<RequestTierUpgradeCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: RequestTierUpgradeCommand,
  ): Promise<RequestTierUpgradeResponseDto> {
    const { partyId, targetTier } = command.payload;

    if (!partyId || targetTier === undefined) {
      throw new PartyInvariantError('partyId and targetTier are required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    try {
      party.providerRole.updateTier(targetTier);
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Provider tier updated', { partyId });

      return {
        partyId,
        tier: party.providerRole.tier,
      };
    } catch (error) {
      this.logger.error('Failed to request tier upgrade', error as Error, {
        partyId,
      });
      throw error;
    }
  }
}
