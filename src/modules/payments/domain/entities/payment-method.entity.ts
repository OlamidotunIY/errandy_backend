import { AggregateRoot } from '@src/common';
import { PaymentMethodId } from '../value-objects';
import { PaymentMethodAddedEvent } from '../events';

export type PaymentMethodType = 'card' | 'bank_account' | 'wallet' | 'paypal';

interface PaymentMethodProps {
  id: PaymentMethodId;
  partyId: string;
  provider: string;
  providerRef: string;
  type: PaymentMethodType;
  cardBrand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentMethod extends AggregateRoot<PaymentMethodId> {
  private _isDefault: boolean;
  private _isActive: boolean;
  private _updatedAt: Date;

  private constructor(private readonly props: PaymentMethodProps) {
    super(props.id);
    this._isDefault = props.isDefault;
    this._isActive = props.isActive;
    this._updatedAt = props.updatedAt;
  }

  static create(
    partyId: string,
    provider: string,
    providerRef: string,
    type: PaymentMethodType,
    card: {
      cardBrand?: string;
      last4?: string;
      expMonth?: number;
      expYear?: number;
    },
    isFirstForParty: boolean,
    correlationId: string,
  ): PaymentMethod {
    const now = new Date();
    const method = new PaymentMethod({
      id: PaymentMethodId.create(),
      partyId,
      provider,
      providerRef,
      type,
      cardBrand: card.cardBrand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      isDefault: isFirstForParty,
      verified: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    method.addDomainEvent(
      PaymentMethodAddedEvent.fromAggregate(method, correlationId),
    );

    return method;
  }

  static reconstitute(props: PaymentMethodProps): PaymentMethod {
    return new PaymentMethod(props);
  }

  markDefault(): void {
    this._isDefault = true;
    this._updatedAt = new Date();
  }

  unmarkDefault(): void {
    this._isDefault = false;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  get partyId(): string {
    return this.props.partyId;
  }

  get provider(): string {
    return this.props.provider;
  }

  get providerRef(): string {
    return this.props.providerRef;
  }

  get type(): PaymentMethodType {
    return this.props.type;
  }

  get cardBrand(): string | undefined {
    return this.props.cardBrand;
  }

  get last4(): string | undefined {
    return this.props.last4;
  }

  get expMonth(): number | undefined {
    return this.props.expMonth;
  }

  get expYear(): number | undefined {
    return this.props.expYear;
  }

  get isDefault(): boolean {
    return this._isDefault;
  }

  get verified(): boolean {
    return this.props.verified;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
