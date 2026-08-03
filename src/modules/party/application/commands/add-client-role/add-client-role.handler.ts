import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AddClientRoleCommand, AddClientRoleResponseDto } from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(AddClientRoleCommand)
export class AddClientRoleHandler implements ICommandHandler<AddClientRoleCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: AddClientRoleCommand,
  ): Promise<AddClientRoleResponseDto> {
    const { partyId } = command.payload;

    if (!partyId) {
      throw new PartyInvariantError('partyId is required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    try {
      party.addClientRole();
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Client role added', { partyId: party.id.value });

      return {
        partyId: party.id.value,
      };
    } catch (error) {
      this.logger.error('Failed to add client role', error as Error, {
        partyId,
      });
      throw error;
    }
  }
}
