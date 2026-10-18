import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BookServiceCommand } from './book-service.command';
import { BookServiceResponseDto } from './book-service.request.dto';
import {
  Errand,
  ErrandAssignment,
  ErrandInvariantError,
  IErrandRepository,
  SourceType,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import {
  CategoryTierMismatchError,
  IAddressReadPort,
  ICategoryReadPort,
  ILogger,
  IPartyReadPort,
  IServiceReadPort,
  meetsRequiredTier,
  ProviderRoleNotFoundError,
  ReferenceNotFoundError,
} from '@src/common';

@CommandHandler(BookServiceCommand)
export class BookServiceHandler implements ICommandHandler<BookServiceCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyReadPort: IPartyReadPort,
    private readonly serviceReadPort: IServiceReadPort,
    private readonly categoryReadPort: ICategoryReadPort,
    private readonly addressReadPort: IAddressReadPort,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: BookServiceCommand): Promise<BookServiceResponseDto> {
    const { payload } = command;

    if (!payload.clientPartyId || !payload.serviceId || !payload.addressId) {
      throw new ErrandInvariantError('Missing required fields');
    }

    const clientParty = await this.partyReadPort.findById(
      payload.clientPartyId,
    );
    if (!clientParty) {
      throw new ReferenceNotFoundError('Party', payload.clientPartyId);
    }

    const service = await this.serviceReadPort.findById(payload.serviceId);
    if (!service) {
      throw new ReferenceNotFoundError('Service', payload.serviceId);
    }

    const listerParty = await this.partyReadPort.findById(service.listedById);
    if (!listerParty) {
      throw new ReferenceNotFoundError('Party', service.listedById);
    }
    if (!listerParty.providerTier) {
      throw new ProviderRoleNotFoundError(service.listedById);
    }

    const category = await this.categoryReadPort.findById(service.categoryId);
    if (!category) {
      throw new ReferenceNotFoundError('Category', service.categoryId);
    }
    if (!meetsRequiredTier(category.requiredTier, listerParty.providerTier)) {
      throw new CategoryTierMismatchError(
        service.listedById,
        service.categoryId,
      );
    }

    const location = await this.addressReadPort.findLocationById(
      payload.addressId,
    );
    if (!location) {
      throw new ReferenceNotFoundError('Address', payload.addressId);
    }

    const price = Money.fromMinorUnits(
      service.priceMinorUnits,
      service.currency as Currency,
    );

    const errand = Errand.create(
      payload.clientPartyId,
      service.categoryId,
      service.title,
      service.description,
      payload.addressId,
      location,
      price,
      clientParty.marketId,
      SourceType.SERVICE_BOOKING,
      listerParty.providerTier as any,
    );

    errand.assignTo(service.id);

    const assignment = ErrandAssignment.create(errand.id, service.listedById);

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
