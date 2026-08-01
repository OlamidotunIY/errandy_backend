import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BookServiceCommand, BookServiceResponseDto } from '.';
import {
  Errand,
  ErrandAssignment,
  ErrandInvariantError,
  IErrandRepository,
  SourceType,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import { IPartyRepository, PartyNotFoundError } from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(BookServiceCommand)
export class BookServiceHandler implements ICommandHandler<BookServiceCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: BookServiceCommand): Promise<BookServiceResponseDto> {
    const { payload } = command;

    if (!payload.clientId || !payload.serviceId || !payload.assignedProfileId) {
      throw new ErrandInvariantError('Missing required fields');
    }

    const clientParty = await this.partyRepository.findById(payload.clientId);
    if (!clientParty) {
      throw new PartyNotFoundError(payload.clientId);
    }

    // NOTE: the `service` module has no domain/infrastructure implementation
    // yet, so the current tier of the Service listing cannot be re-validated
    // here as the docs require — deferred until that module is built.
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
      SourceType.SERVICE_BOOKING,
    );

    errand.assignTo(payload.serviceId);

    const assignment = ErrandAssignment.create(
      errand.id,
      payload.assignedProfileId,
    );

    await this.errandRepository.save(errand);
    await this.errandRepository.saveAssignment(assignment);

    for (const event of [
      ...errand.pullDomainEvents(),
      ...assignment.pullDomainEvents(),
    ]) {
      this.eventBus.publish(event);
    }

    this.logger.info('Service booked as ASSIGNED errand', {
      errandId: errand.id.value,
    });

    return { errandId: errand.id.value, status: 'ASSIGNED' };
  }
}
