import { Injectable } from '@nestjs/common';
import { GeoJsonPointSnapshot, IAddressReadPort } from '@src/common';
import { AddressId, IAddressRepository } from '../../domain';

@Injectable()
export class AddressReadAdapter extends IAddressReadPort {
  constructor(private readonly addressRepository: IAddressRepository) {
    super();
  }

  async findLocationById(
    addressId: string,
  ): Promise<GeoJsonPointSnapshot | null> {
    const address = await this.addressRepository.findById(
      AddressId.fromString(addressId),
    );
    return address ? address.toGeoJson() : null;
  }
}
