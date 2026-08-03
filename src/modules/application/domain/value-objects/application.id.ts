import { EntityId } from '@src/common';

class ApplicationId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ApplicationId {
    return new ApplicationId(crypto.randomUUID());
  }

  static fromString(value: string): ApplicationId {
    return new ApplicationId(value);
  }
}

export { ApplicationId };
