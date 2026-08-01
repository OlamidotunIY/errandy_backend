import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CreateErrandCommand, CreateErrandResponseDto } from '.';
import {
  Errand,
  ErrandInvariantError,
  IErrandRepository,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import { IPartyRepository, PartyNotFoundError } from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(CreateErrandCommand)
export class CreateErrandHandler implements ICommandHandler<CreateErrandCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: CreateErrandCommand,
  ): Promise<CreateErrandResponseDto> {
    const { payload } = command;

    if (!payload.clientId || !payload.categoryId || !payload.addressId) {
      throw new ErrandInvariantError('Missing required fields');
    }

    const clientParty = await this.partyRepository.findById(payload.clientId);
    if (!clientParty) {
      throw new PartyNotFoundError(payload.clientId);
    }

    // NOTE: category leaf validation deferred — category module has no
    // domain/infrastructure implementation yet (stub only).
    // NOTE: location should be denormalized from the chosen Address per
    // errand-discovery-flow.md, but address module has no infrastructure
    // layer yet — accepting an optional location override in the meantime.
    const location = payload.location
      ? {
          type: 'Point',
          coordinates: [payload.location.longitude, payload.location.latitude],
        }
      : null;

    const budget = Money.fromMinorUnits(
      payload.budget.amountMinorUnits,
      payload.budget.currency as Currency,
    );

    const errand = Errand.create(
      payload.clientId,
      payload.categoryId,
      payload.title,
      payload.description,
      payload.addressId,
      location,
      budget,
      clientParty.marketId,
    );

    await this.errandRepository.save(errand);

    const events = errand.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    this.logger.info('Errand created', { errandId: errand.id.value });

    return {
      errandId: errand.id.value,
      status: 'DRAFT',
    };
  }
}
