import { AggregateRoot } from '@src/common';
import { MarketId } from '../';

interface MarketProps {
  id: MarketId;
  countryCode: string;
  currency: string;
  verificationChargeAmountMinorUnits: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Market extends AggregateRoot<MarketId> {
  private readonly _countryCode: string;
  private readonly _currency: string;
  private readonly _verificationChargeAmountMinorUnits: number;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(props: MarketProps) {
    super(props.id);
    this._countryCode = props.countryCode;
    this._currency = props.currency;
    this._verificationChargeAmountMinorUnits =
      props.verificationChargeAmountMinorUnits;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static reconstitute(props: MarketProps): Market {
    return new Market(props);
  }

  get countryCode(): string {
    return this._countryCode;
  }

  get currency(): string {
    return this._currency;
  }

  get verificationChargeAmountMinorUnits(): number {
    return this._verificationChargeAmountMinorUnits;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
