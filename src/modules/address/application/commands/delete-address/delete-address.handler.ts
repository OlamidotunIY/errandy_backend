import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteAddressCommand } from './delete-address.command';
import {
  AddressId,
  AddressNotFoundError,
  IAddressRepository,
} from '@module/address/domain';
import { ILogger } from '@src/common';

@CommandHandler(DeleteAddressCommand)
export class DeleteAddressHandler
  implements ICommandHandler<DeleteAddressCommand, boolean>
{
  constructor(
    private readonly addressRepo: IAddressRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: DeleteAddressCommand): Promise<boolean> {
    const { addressId, userId } = command.payload;
    const address = await this.addressRepo.findById(
      AddressId.fromString(addressId),
    );
    if (!address) {
      throw new AddressNotFoundError(addressId);
    }

    if (address.ownerUserId.value !== userId.value) {
      throw new AddressNotFoundError(addressId);
    }

    await this.addressRepo.delete(address.id);
    this.logger.info(`Address deleted`, { addressId });

    return true;
  }
}
