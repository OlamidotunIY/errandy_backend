import { EntityId } from '@shared';

class AddressId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): AddressId {
    return new AddressId(crypto.randomUUID());
  }

  static fromString(value: string): AddressId {
    return new AddressId(value);
  }
}

export { AddressId };
