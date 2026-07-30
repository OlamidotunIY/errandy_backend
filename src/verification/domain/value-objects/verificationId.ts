import { EntityId } from '@src/common';

class verificationId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): verificationId {
    return new verificationId(crypto.randomUUID());
  }

  static fromString(value: string) {
    return new verificationId(value);
  }
}
export { verificationId };
