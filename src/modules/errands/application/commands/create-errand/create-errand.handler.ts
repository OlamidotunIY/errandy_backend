import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CreateErrandCommand, CreateErrandResponseDto } from '.';
import {
  Errand,
  ErrandInvariantError,
  IErrandRepository,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import { IPartyRepository, PartyNotFoundError } from '@module/party';
import {
  CategoryNotFoundError,
  CategoryNotLeafError,
  ICategoryRepository,
} from '@module/category';
import {
  AddressId,
  AddressNotFoundError,
  IAddressRepository,
} from '@module/address';
import { ILogger } from '@src/common';

@CommandHandler(CreateErrandCommand)
export class CreateErrandHandler implements ICommandHandler<CreateErrandCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly addressRepository: IAddressRepository,
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

    const clientParty = await this.partyRepository.findById(payload.clientPartyId);
    if (!clientParty) {
      throw new PartyNotFoundError(payload.clientPartyId);
    }

    const category = await this.categoryRepository.findById(payload.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(payload.categoryId);
    }
    if (!category.isLeaf()) {
      throw new CategoryNotLeafError(payload.categoryId);
    }

    const address = await this.addressRepository.findById(
      AddressId.fromString(payload.addressId),
    );
    if (!address) {
      throw new AddressNotFoundError(payload.addressId);
    }
    const location = address.toGeoJson();

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
