import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  Address,
  AddressDto,
  Coordinates,
  CreateAddressCommand,
  IAddressRepository,
} from '@module/address';
import { ILogger } from '@src/common';

@CommandHandler(CreateAddressCommand)
export class CreateAddressHandler implements ICommandHandler<CreateAddressCommand> {
  constructor(
    private readonly addressRepo: IAddressRepository,
    private readonly logger: ILogger,
    private readonly eventPublisher: EventBus,
  ) {}

  async execute(command: CreateAddressCommand): Promise<AddressDto> {
    const { state, country, street, userId, label, city, coordinates } =
      command.payload;

    const addressCoordinates = Coordinates.create(
      coordinates.latitude,
      coordinates.longitude,
    );

    const address = Address.create(
      userId,
      label,
      street,
      city,
      state,
      country,
      addressCoordinates,
    );

    await this.addressRepo.save(address);

    const addressEvents = address.pullDomainEvents();

    for (const event of addressEvents) {
      this.eventPublisher.publish(event);
    }

    this.logger.info(`Address created for user ${userId.value}`, {
      addressId: address.id.value,
    });

    return {
      id: address.id.value,
      userId: address.ownerUserId.value,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      country: address.country,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
