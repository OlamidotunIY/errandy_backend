import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CreateErrandCommand } from './create-errand.command';
import { CreateErrandResponseDto } from './create-errand.request.dto';
import {
  Errand,
  ErrandInvariantError,
  IErrandRepository,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import {
  CategoryNotLeafError,
  IAddressReadPort,
  ICategoryReadPort,
  ILogger,
  IPartyReadPort,
  ReferenceNotFoundError,
} from '@src/common';

@CommandHandler(CreateErrandCommand)
export class CreateErrandHandler implements ICommandHandler<CreateErrandCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyReadPort: IPartyReadPort,
    private readonly categoryReadPort: ICategoryReadPort,
    private readonly addressReadPort: IAddressReadPort,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: CreateErrandCommand,
  ): Promise<CreateErrandResponseDto> {
    const { payload } = command;

    if (!payload.clientPartyId || !payload.categoryId || !payload.addressId) {
      throw new ErrandInvariantError('Missing required fields');
    }

    const clientParty = await this.partyReadPort.findById(
      payload.clientPartyId,
    );
    if (!clientParty) {
      throw new ReferenceNotFoundError('Party', payload.clientPartyId);
    }

    const category = await this.categoryReadPort.findById(payload.categoryId);
    if (!category) {
      throw new ReferenceNotFoundError('Category', payload.categoryId);
    }
    if (!category.isLeaf) {
      throw new CategoryNotLeafError(payload.categoryId);
    }

    const location = await this.addressReadPort.findLocationById(
      payload.addressId,
    );
    if (!location) {
      throw new ReferenceNotFoundError('Address', payload.addressId);
    }

    const budget = Money.fromMinorUnits(
      payload.budget.amountMinorUnits,
      payload.budget.currency as Currency,
    );

    const errand = Errand.create(
      payload.clientPartyId,
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
