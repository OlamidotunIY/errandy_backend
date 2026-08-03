import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BookServiceCommand, BookServiceResponseDto } from '.';
import {
  Errand,
  ErrandAssignment,
  ErrandInvariantError,
  IErrandRepository,
  SourceType,
} from '@module/errands/domain';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import {
  ICategoryRepository,
  CategoryNotFoundError,
  CategoryTierMismatchError,
} from '@module/category';
import {
  IServiceRepository,
  ServiceNotFoundError,
} from '@module/service/domain';
import {
  AddressId,
  AddressNotFoundError,
  IAddressRepository,
} from '@module/address';
import { ILogger } from '@src/common';

@CommandHandler(BookServiceCommand)
export class BookServiceHandler implements ICommandHandler<BookServiceCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly addressRepository: IAddressRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: BookServiceCommand): Promise<BookServiceResponseDto> {
    const { payload } = command;

    if (!payload.clientPartyId || !payload.serviceId || !payload.addressId) {
      throw new ErrandInvariantError('Missing required fields');
    }

    const clientParty = await this.partyRepository.findById(payload.clientPartyId);
    if (!clientParty) {
      throw new PartyNotFoundError(payload.clientPartyId);
    }

    const service = await this.serviceRepository.findById(payload.serviceId);
    if (!service) {
      throw new ServiceNotFoundError(payload.serviceId);
    }

    const listerParty = await this.partyRepository.findById(service.listedById);
    if (!listerParty) {
      throw new PartyNotFoundError(service.listedById);
    }
    if (!listerParty.providerRole) {
      throw new ProviderRoleNotFoundError(service.listedById);
    }

    const category = await this.categoryRepository.findById(service.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(service.categoryId);
    }
    if (!category.meetsRequiredTier(listerParty.providerRole.tier)) {
      throw new CategoryTierMismatchError(
        service.listedById,
        service.categoryId,
      );
    }

    const address = await this.addressRepository.findById(
      AddressId.fromString(payload.addressId),
    );
    if (!address) {
      throw new AddressNotFoundError(payload.addressId);
    }
    const location = address.toGeoJson();

    const errand = Errand.create(
      payload.clientPartyId,
      service.categoryId,
      service.title,
      service.description,
      payload.addressId,
      location,
      service.price,
      clientParty.marketId,
      SourceType.SERVICE_BOOKING,
      listerParty.providerRole.tier,
    );

    errand.assignTo(service.id.value);

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
