import { Address, AddressId } from '@module/address';
import { UserId } from '@module/user';

export abstract class IAddressRepository {
  abstract save(address: Address): Promise<void>;
  abstract findById(id: AddressId): Promise<Address | null>;
  abstract findByUserId(id: UserId): Promise<Address[]>;
  abstract delete(id: AddressId): Promise<void>;
}
