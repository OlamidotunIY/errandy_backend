import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
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
  ) {}

  async execute(command: CreateAddressCommand): Promise<AddressDto> {
    const { state, country, street, userId, label, city, coordinates } =
      command.payload;

    const addressCord = Coordinates.create(
      coordinates.latitude,
      coordinates.longitude,
    );

    throw new Error('Method not implemented.');
  }
}
