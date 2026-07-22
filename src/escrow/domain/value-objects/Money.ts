import {
  InvalidAmountError,
  CurrencyMismatchError,
  NegativeAmountError,
} from '../errors';

type Currency = 'NGN';

class Money {
  private constructor(
    public readonly amountKobo: number,
    public readonly currency: Currency,
  ) {
    if (amountKobo < 0) {
      throw new InvalidAmountError('Money amount cannot be negative');
    }
  }

  static fromKobo(amountKobo: number, currency: Currency = 'NGN'): Money {
    return new Money(amountKobo, currency);
  }

  static fromNaira(amountNaira: number, currency: Currency = 'NGN'): Money {
    const amountKobo = Math.round(amountNaira * 100);
    return new Money(amountKobo, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    return Money.fromKobo(this.amountKobo + other.amountKobo, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    if (this.amountKobo < other.amountKobo) {
      throw new NegativeAmountError(
        'Subtraction would result in negative amount',
      );
    }
    return Money.fromKobo(this.amountKobo - other.amountKobo, this.currency);
  }

  splitFee(basisPoints: number): [Money, Money] {
    const feeAmount = Math.round((this.amountKobo * basisPoints) / 10000);
    const platformFee = Money.fromKobo(feeAmount, this.currency);
    const netAmount = Money.fromKobo(
      this.amountKobo - feeAmount,
      this.currency,
    );
    return [platformFee, netAmount];
  }

  toKobo(): number {
    return this.amountKobo;
  }
  toNaira(): number {
    return this.amountKobo / 100;
  }
  toString(): string {
    return `₦${this.toNaira().toFixed(2)}`;
  }

  equals(other: Money): boolean {
    return (
      this.amountKobo === other.amountKobo && this.currency === other.currency
    );
  }
}

export { Money, Currency };
