import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ListServiceCommand } from './list-service.command';
import { ListServiceResponseDto } from './list-service.request.dto';
import { IServiceRepository, Service } from '@module/service/domain';
import { Currency, Money } from '@module/escrow/domain';
import {
  CategoryNotLeafError,
  CategoryTierMismatchError,
  ICategoryReadPort,
  ILogger,
  IPartyReadPort,
  ProviderRoleNotFoundError,
  ReferenceNotFoundError,
  meetsRequiredTier,
} from '@src/common';

@CommandHandler(ListServiceCommand)
export class ListServiceHandler implements ICommandHandler<ListServiceCommand> {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly partyReadPort: IPartyReadPort,
    private readonly categoryReadPort: ICategoryReadPort,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: ListServiceCommand): Promise<ListServiceResponseDto> {
    const { payload } = command;

    const listerParty = await this.partyReadPort.findById(payload.listedById);
    if (!listerParty) {
      throw new ReferenceNotFoundError('Party', payload.listedById);
    }
    if (!listerParty.providerTier) {
      throw new ProviderRoleNotFoundError(payload.listedById);
    }

    const category = await this.categoryReadPort.findById(payload.categoryId);
    if (!category) {
      throw new ReferenceNotFoundError('Category', payload.categoryId);
    }
    if (!category.isLeaf) {
      throw new CategoryNotLeafError(payload.categoryId);
    }
    if (!meetsRequiredTier(category.requiredTier, listerParty.providerTier)) {
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
