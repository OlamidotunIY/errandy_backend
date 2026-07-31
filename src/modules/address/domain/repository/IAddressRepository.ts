import { Address, AddressId } from '@module/address';
import { UserId } from '@module/user';

export abstract class IAddressRepository {
  abstract save(address: Address): void;
  abstract findById(id: AddressId): Address;
  abstract findByUserId(id: UserId): Address;
}
