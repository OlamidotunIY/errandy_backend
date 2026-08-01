import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  AwardBadgeCommand,
  AwardBadgeResponseDto,
  ProviderBadge,
  ProviderBadgeId,
} from '@module/party';
import {
  IPartyRepository,
  IProviderBadgeRepository,
  PartyInvariantError,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { PartyId } from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(AwardBadgeCommand)
export class AwardBadgeHandler implements ICommandHandler<AwardBadgeCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly providerBadgeRepository: IProviderBadgeRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: AwardBadgeCommand): Promise<AwardBadgeResponseDto> {
    const { partyId, badgeType, awardedByOrganizationId, period } =
      command.payload;

    if (
      !partyId ||
      badgeType === undefined ||
      !awardedByOrganizationId ||
      !period
    ) {
      throw new PartyInvariantError(
        'partyId, badgeType, awardedByOrganizationId and period are required',
      );
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    const badge = new ProviderBadge(
      ProviderBadgeId.create(),
      party.id,
      badgeType,
      PartyId.fromString(awardedByOrganizationId),
      period,
      new Date(),
    );

    try {
      await this.providerBadgeRepository.save(badge);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Provider badge awarded', {
        badgeId: badge.id.value,
        partyId,
      });

      return {
        badgeId: badge.id.value,
        partyId,
        badgeType,
      };
    } catch (error) {
      this.logger.error('Failed to award provider badge', error as Error, {
        partyId,
      });
      throw error;
    }
  }
}
