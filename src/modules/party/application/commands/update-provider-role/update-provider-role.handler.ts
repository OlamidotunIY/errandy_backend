import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  UpdateProviderRoleCommand,
  UpdateProviderRoleResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(UpdateProviderRoleCommand)
export class UpdateProviderRoleHandler implements ICommandHandler<UpdateProviderRoleCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: UpdateProviderRoleCommand,
  ): Promise<UpdateProviderRoleResponseDto> {
    const { partyId, bio, skills, addToSkills, tier } = command.payload;

    if (!partyId) {
      throw new PartyInvariantError('partyId is required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.providerRole) {
      throw new ProviderRoleNotFoundError(partyId);
    }

    try {
      if (bio !== undefined || skills !== undefined) {
        party.providerRole.updateProfile(bio, skills, addToSkills ?? false);
      }

      if (tier !== undefined) {
        party.providerRole.updateTier(tier);
      }

      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Provider role updated', { partyId });

      return {
        partyId,
        tier: party.providerRole.tier,
        bio: party.providerRole.bio,
        skills: party.providerRole.skills,
      };
    } catch (error) {
      this.logger.error('Failed to update provider role', error as Error, {
        partyId,
      });
      throw error;
    }
  }
}
