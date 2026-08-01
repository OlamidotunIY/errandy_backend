export class AddressNotFoundError extends Error {
  constructor(addressId: string) {
    super(`Address with id - ${addressId} was not found in our system`);
    this.name = AddressNotFoundError.name;
  }
}
