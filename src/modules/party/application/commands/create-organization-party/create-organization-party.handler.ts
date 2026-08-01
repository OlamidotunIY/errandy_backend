import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  CreateOrganizationPartyCommand,
  CreateOrganizationPartyResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  OrganizationPartyAlreadyExistsError,
  Party,
  PartyInvariantError,
} from '@module/party';
import { UserId } from '@module/user';
import { ILogger } from '@src/common';

@CommandHandler(CreateOrganizationPartyCommand)
export class CreateOrganizationPartyHandler implements ICommandHandler<CreateOrganizationPartyCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: CreateOrganizationPartyCommand,
  ): Promise<CreateOrganizationPartyResponseDto> {
    const { ownerId, name, businessRegistrationNumber, marketId } =
      command.payload;

    if (!ownerId || !name || !businessRegistrationNumber || !marketId) {
      throw new PartyInvariantError(
        'ownerId, name, businessRegistrationNumber and marketId are required',
      );
    }

    const existingByRegistration =
      await this.partyRepository.findByBusinessRegistrationNumber(
        businessRegistrationNumber,
      );

    if (existingByRegistration) {
      this.logger.warn('Organization party already exists', {
        ownerId,
        businessRegistrationNumber,
      });
      throw new OrganizationPartyAlreadyExistsError(
        ownerId,
        businessRegistrationNumber,
      );
    }

    const party = Party.createOrganization(
      UserId.fromString(ownerId),
      name,
      businessRegistrationNumber,
      marketId,
    );

    try {
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Organization party created', {
        partyId: party.id.value,
      });

      return { partyId: party.id.value };
    } catch (error) {
      this.logger.error('Failed to create organization party', error as Error, {
        ownerId,
      });
      throw error;
    }
  }
}
