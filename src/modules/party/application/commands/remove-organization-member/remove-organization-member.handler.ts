import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  RemoveOrganizationMemberCommand,
  RemoveOrganizationMemberResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '@module/party';
import { UserId } from '@module/user';
import { ILogger } from '@src/common';

@CommandHandler(RemoveOrganizationMemberCommand)
export class RemoveOrganizationMemberHandler implements ICommandHandler<RemoveOrganizationMemberCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: RemoveOrganizationMemberCommand,
  ): Promise<RemoveOrganizationMemberResponseDto> {
    const { organizationPartyId, userId } = command.payload;

    if (!organizationPartyId || !userId) {
      throw new PartyInvariantError(
        'organizationPartyId and userId are required',
      );
    }

    const party = await this.partyRepository.findById(organizationPartyId);
    if (!party) {
      throw new PartyNotFoundError(organizationPartyId);
    }

    try {
      party.removeOrganizationMember(UserId.fromString(userId));
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Organization member removed', {
        organizationPartyId,
        userId,
      });

      return { organizationPartyId, userId };
    } catch (error) {
      this.logger.error(
        'Failed to remove organization member',
        error as Error,
        {
          organizationPartyId,
          userId,
        },
      );
      throw error;
    }
  }
}
