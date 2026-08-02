import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  CreatePersonPartyCommand,
  CreatePersonPartyResponseDto,
} from '@module/party';
import {
  IPartyRepository,
  Party,
  PartyInvariantError,
  PersonPartyAlreadyExistsError,
} from '@module/party';
import { UserId } from '@module/user';
import { ILogger } from '@src/common';

@CommandHandler(CreatePersonPartyCommand)
export class CreatePersonPartyHandler implements ICommandHandler<CreatePersonPartyCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: CreatePersonPartyCommand,
  ): Promise<CreatePersonPartyResponseDto> {
    const { userId, marketId, correlationId } = command.payload;

    if (!userId || !marketId) {
      throw new PartyInvariantError('userId and marketId are required');
    }

    const existingParty = await this.partyRepository.findByUserId(userId);
    if (existingParty) {
      this.logger.warn('Person party already exists', { userId });
      throw new PersonPartyAlreadyExistsError(userId);
    }

    const party = Party.createPerson(
      UserId.fromString(userId),
      marketId,
      correlationId,
    );

    try {
      await this.partyRepository.save(party);

      const events = party.pullDomainEvents();
      for (const event of events) {
        this.eventBus.publish(event);
      }

      this.logger.info('Person party created', {
        partyId: party.id.value,
      });

      return { partyId: party.id.value };
    } catch (error) {
      this.logger.error('Failed to create person party', error as Error, {
        userId,
      });
      throw error;
    }
  }
}
