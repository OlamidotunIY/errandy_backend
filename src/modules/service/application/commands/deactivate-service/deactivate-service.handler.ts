import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { DeactivateServiceCommand, DeactivateServiceResponseDto } from '.';
import {
  IServiceRepository,
  ServiceNotFoundError,
} from '@module/service/domain';
import { ILogger } from '@src/common';

@CommandHandler(DeactivateServiceCommand)
export class DeactivateServiceHandler implements ICommandHandler<DeactivateServiceCommand> {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: DeactivateServiceCommand,
  ): Promise<DeactivateServiceResponseDto> {
    const { payload } = command;

    const service = await this.serviceRepository.findById(payload.serviceId);
    if (!service) {
      throw new ServiceNotFoundError(payload.serviceId);
    }

    service.deactivate();
    await this.serviceRepository.save(service);

    for (const event of service.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Service deactivated', { serviceId: service.id.value });

    return { serviceId: service.id.value };
  }
}
