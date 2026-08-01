import {
  InvalidAmountError,
  CurrencyMismatchError,
  NegativeAmountError,
  UnsupportedCurrencyError,
} from '../errors';

/**
 * ISO 4217 minor-unit exponents. Not every currency uses 2 decimal places —
 * JPY uses 0, BHD/KWD/OMR use 3. Extend as new markets launch (see Market seed data).
 */
const CURRENCY_EXPONENTS = {
  NGN: 2,
  GHS: 2,
  USD: 2,
} as const;

type Currency = keyof typeof CURRENCY_EXPONENTS;

class Money {
  private constructor(
    public readonly amountMinorUnits: number,
    public readonly currency: Currency,
  ) {
    if (!(currency in CURRENCY_EXPONENTS)) {
      throw new UnsupportedCurrencyError(currency);
    }
    if (!Number.isInteger(amountMinorUnits)) {
      throw new InvalidAmountError(
        'Money amount must be an integer number of minor units',
      );
    }
    if (amountMinorUnits < 0) {
      throw new InvalidAmountError('Money amount cannot be negative');
    }
  }

  static fromMinorUnits(amountMinorUnits: number, currency: Currency): Money {
    return new Money(amountMinorUnits, currency);
  }

  static fromMajorUnits(amountMajorUnits: number, currency: Currency): Money {
    const exponent = CURRENCY_EXPONENTS[currency];
    return new Money(Math.round(amountMajorUnits * 10 ** exponent), currency);
  }

  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(
      this.amountMinorUnits + other.amountMinorUnits,
      this.currency,
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (this.amountMinorUnits < other.amountMinorUnits) {
      throw new NegativeAmountError(
        'Subtraction would result in a negative amount',
      );
    }
    return Money.fromMinorUnits(
      this.amountMinorUnits - other.amountMinorUnits,
      this.currency,
    );
  }

  multiply(factor: number): Money {
    return Money.fromMinorUnits(
      Math.round(this.amountMinorUnits * factor),
      this.currency,
    );
  }

  /**
   * Splits this amount proportionally across N weights, guaranteeing the parts
   * sum EXACTLY to the original amount — the Largest Remainder Method, replacing
   * naive per-part floor/round (which silently drifts). See the payout-split
   * writeup in docs/flows/errand-completion-flow.md — this is the general form
   * of that same problem, now a reusable method rather than duplicated logic.
   */
  split(weights: number[]): Money[] {
    if (weights.length === 0) return [];
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) {
      throw new InvalidAmountError(
        'Split weights must sum to a positive number',
      );
    }

    const exact = weights.map((w) => (this.amountMinorUnits * w) / totalWeight);
    const floors = exact.map(Math.floor);
    const remainder =
      this.amountMinorUnits - floors.reduce((sum, f) => sum + f, 0);

    const byLargestFraction = exact
      .map((value, index) => ({ index, fraction: value - floors[index] }))
      .sort((a, b) => b.fraction - a.fraction);

    const amounts = [...floors];
    for (let i = 0; i < remainder; i++) {
      amounts[byLargestFraction[i % byLargestFraction.length].index] += 1;
    }

    return amounts.map((amount) => Money.fromMinorUnits(amount, this.currency));
  }

  /** Two-way convenience wrapper over split() — e.g. platform fee vs. net payout */
  splitFee(basisPoints: number): [platformFee: Money, netAmount: Money] {
    const [fee, net] = this.split([basisPoints, 10_000 - basisPoints]);
    return [fee, net];
  }

  isZero(): boolean {
    return this.amountMinorUnits === 0;
  }

  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinorUnits >= other.amountMinorUnits;
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinorUnits < other.amountMinorUnits;
  }

  toMinorUnits(): number {
    return this.amountMinorUnits;
  }

  toMajorUnits(): number {
    return this.amountMinorUnits / 10 ** CURRENCY_EXPONENTS[this.currency];
  }

  toString(): string {
    // Intl.NumberFormat handles per-currency symbol and decimal places correctly —
    // no hand-rolled symbol map, which is what a hardcoded ₦ was doing before.
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: this.currency,
    }).format(this.toMajorUnits());
  }

  equals(other: Money): boolean {
    return (
      this.amountMinorUnits === other.amountMinorUnits &&
      this.currency === other.currency
    );
  }

  /** Crosses the Prisma composite-type boundary — see docs/modules/*.md, every Money field is { amountMinorUnits, currency } */
  toJSON(): { amountMinorUnits: number; currency: Currency } {
    return { amountMinorUnits: this.amountMinorUnits, currency: this.currency };
  }

  static fromJSON(json: { amountMinorUnits: number; currency: string }): Money {
    return Money.fromMinorUnits(
      json.amountMinorUnits,
      json.currency as Currency,
    );
  }
}

export { Money, Currency };
