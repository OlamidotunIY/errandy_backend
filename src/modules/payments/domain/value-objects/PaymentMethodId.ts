import { EntityId } from '@src/common';

class PaymentMethodId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): PaymentMethodId {
    return new PaymentMethodId(crypto.randomUUID());
  }

  static fromString(value: string): PaymentMethodId {
    return new PaymentMethodId(value);
  }
}

export { PaymentMethodId };
