import { EntityId } from '@src/common';

class ClientId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ClientId {
    return new ClientId(crypto.randomUUID());
  }

  static fromString(value: string): ClientId {
    return new ClientId(value);
  }
}

export { ClientId };
