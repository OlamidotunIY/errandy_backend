import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  AddOrganizationMemberCommand,
  AddOrganizationMemberResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '@module/party';
import { UserId } from '@module/user';
import { ILogger } from '@src/common';

@CommandHandler(AddOrganizationMemberCommand)
export class AddOrganizationMemberHandler implements ICommandHandler<AddOrganizationMemberCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: AddOrganizationMemberCommand,
  ): Promise<AddOrganizationMemberResponseDto> {
    const { organizationPartyId, userId, role } = command.payload;

    if (!organizationPartyId || !userId || role === undefined) {
      throw new PartyInvariantError(
        'organizationPartyId, userId and role are required',
      );
    }

    const party = await this.partyRepository.findById(organizationPartyId);
    if (!party) {
      throw new PartyNotFoundError(organizationPartyId);
    }

    try {
      party.addOrganizationMember(UserId.fromString(userId), role);
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Organization member added', {
        organizationPartyId,
        userId,
      });

      return { organizationPartyId, userId, role };
    } catch (error) {
      this.logger.error('Failed to add organization member', error as Error, {
        organizationPartyId,
        userId,
      });
      throw error;
    }
  }
}
