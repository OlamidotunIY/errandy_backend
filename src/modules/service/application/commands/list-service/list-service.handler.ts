import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ListServiceCommand, ListServiceResponseDto } from '.';
import { IServiceRepository, Service } from '@module/service/domain';
import { Currency, Money } from '@module/escrow/domain';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import {
  CategoryNotFoundError,
  CategoryNotLeafError,
  CategoryTierMismatchError,
  ICategoryRepository,
} from '@module/category';
import { ILogger } from '@src/common';

@CommandHandler(ListServiceCommand)
export class ListServiceHandler implements ICommandHandler<ListServiceCommand> {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: ListServiceCommand): Promise<ListServiceResponseDto> {
    const { payload } = command;

    const listerParty = await this.partyRepository.findById(payload.listedById);
    if (!listerParty) {
      throw new PartyNotFoundError(payload.listedById);
    }
    if (!listerParty.providerRole) {
      throw new ProviderRoleNotFoundError(payload.listedById);
    }

    const category = await this.categoryRepository.findById(payload.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(payload.categoryId);
    }
    if (!category.isLeaf()) {
      throw new CategoryNotLeafError(payload.categoryId);
    }
    if (!category.meetsRequiredTier(listerParty.providerRole.tier)) {
      throw new CategoryTierMismatchError(
        payload.listedById,
        payload.categoryId,
      );
    }

    const price = Money.fromMinorUnits(
      payload.price.amountMinorUnits,
      payload.price.currency as Currency,
    );

    const service = Service.create(
      payload.listedById,
      payload.categoryId,
      listerParty.marketId,
      payload.title,
      payload.description,
      price,
    );

    await this.serviceRepository.save(service);

    for (const event of service.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Service listed', { serviceId: service.id.value });

    return { serviceId: service.id.value };
  }
}
