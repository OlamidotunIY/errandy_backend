import { EntityId } from '@src/common';

export class ServiceId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ServiceId {
    return new ServiceId(crypto.randomUUID());
  }

  static fromString(value: string): ServiceId {
    return new ServiceId(value);
  }
}
