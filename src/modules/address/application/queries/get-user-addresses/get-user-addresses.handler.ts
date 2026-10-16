import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserAddressesQuery } from './get-user-addresses.query';
import { AddressDto } from '../../commands/create-address/create-address.payload';
import { IAddressRepository } from '@module/address/domain';

@QueryHandler(GetUserAddressesQuery)
export class GetUserAddressesHandler
  implements IQueryHandler<GetUserAddressesQuery, AddressDto[]>
{
  constructor(private readonly addressRepo: IAddressRepository) {}

  async execute(query: GetUserAddressesQuery): Promise<AddressDto[]> {
    const addresses = await this.addressRepo.findByUserId(query.userId);
    return addresses.map((address) => ({
      id: address.id.value,
      userId: address.ownerUserId.value,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      country: address.country,
      isDefault: address.isDefault,
      coordinates: {
        latitude: address.coordinates.latitude,
        longitude: address.coordinates.longitude,
      },
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    }));
  }
}
