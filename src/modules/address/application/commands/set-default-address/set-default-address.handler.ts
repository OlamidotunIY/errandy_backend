import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { SetDefaultAddressCommand } from './set-default-address.command';
import { AddressNotFoundError, IAddressRepository } from '@module/address/domain';
import { ILogger } from '@src/common';

@CommandHandler(SetDefaultAddressCommand)
export class SetDefaultAddressHandler
  implements ICommandHandler<SetDefaultAddressCommand, boolean>
{
  constructor(
    private readonly addressRepo: IAddressRepository,
    private readonly eventPublisher: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(command: SetDefaultAddressCommand): Promise<boolean> {
    const { addressId, userId } = command.payload;
    const addresses = await this.addressRepo.findByUserId(userId);
    const targetAddress = addresses.find((a) => a.id.value === addressId);
    if (!targetAddress) {
      throw new AddressNotFoundError(addressId);
    }

    for (const address of addresses) {
      if (address.id.value === addressId) {
        address.markAsDefault();
        await this.addressRepo.save(address);
        for (const event of address.pullDomainEvents()) {
          this.eventPublisher.publish(event);
        }
      } else if (address.isDefault) {
        address.removeAsDefault();
        await this.addressRepo.save(address);
      }
    }

    this.logger.info(`Default address set for user ${userId.value}`, {
      addressId,
    });

    return true;
  }
}
