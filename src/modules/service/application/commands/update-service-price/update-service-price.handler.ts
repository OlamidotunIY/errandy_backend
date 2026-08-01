import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UpdateServicePriceCommand, UpdateServicePriceResponseDto } from '.';
import {
  IServiceRepository,
  ServiceNotFoundError,
} from '@module/service/domain';
import { Currency, Money } from '@module/escrow/domain';
import { ILogger } from '@src/common';

@CommandHandler(UpdateServicePriceCommand)
export class UpdateServicePriceHandler implements ICommandHandler<UpdateServicePriceCommand> {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: UpdateServicePriceCommand,
  ): Promise<UpdateServicePriceResponseDto> {
    const { payload } = command;

    const service = await this.serviceRepository.findById(payload.serviceId);
    if (!service) {
      throw new ServiceNotFoundError(payload.serviceId);
    }

    const newPrice = Money.fromMinorUnits(
      payload.price.amountMinorUnits,
      payload.price.currency as Currency,
    );

    service.updatePrice(newPrice);
    await this.serviceRepository.save(service);

    for (const event of service.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Service price updated', {
      serviceId: service.id.value,
    });

    return { serviceId: service.id.value };
  }
}
