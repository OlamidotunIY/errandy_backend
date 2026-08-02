import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  AddProviderRoleCommand,
  AddProviderRoleResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(AddProviderRoleCommand)
export class AddProviderRoleHandler implements ICommandHandler<AddProviderRoleCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: AddProviderRoleCommand,
  ): Promise<AddProviderRoleResponseDto> {
    const { partyId } = command.payload;

    if (!partyId) {
      throw new PartyInvariantError('partyId is required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    try {
      party.addProviderRole();
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Provider role added', { partyId: party.id.value });

      return {
        partyId: party.id.value,
        tier: party.providerRole!.tier,
      };
    } catch (error) {
      this.logger.error('Failed to add provider role', error as Error, {
        partyId,
      });
      throw error;
    }
  }
}
