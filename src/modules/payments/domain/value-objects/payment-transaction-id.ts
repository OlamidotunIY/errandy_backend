import { EntityId } from '@src/common';

export class PaymentTransactionId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): PaymentTransactionId {
    return new PaymentTransactionId(crypto.randomUUID());
  }

  static fromString(value: string): PaymentTransactionId {
    return new PaymentTransactionId(value);
  }
}
