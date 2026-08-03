import { AggregateRoot } from '@src/common';
import {
  ChargeFailedEvent,
  ChargeRefundedEvent,
  ChargeSucceededEvent,
  GatewayReference,
  InvariantTransactionError,
  PaymentMethodId,
  PaymentStatus,
  PaymentTransactionId,
} from '../';
import { PartyId } from '@module/party';
import { ErrandId, Money } from '@src/modules';

export class PaymentTransaction extends AggregateRoot<PaymentTransactionId> {
  constructor(
    id: PaymentTransactionId,
    public readonly clientPartyId: PartyId,
    public readonly purposeId: ErrandId,
    private readonly amount: Money,
    private _status: PaymentStatus,
    private _gatewayReference: GatewayReference | null,
    private _method: PaymentMethodId | null,
    private _failureReason: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static initiate(
    clientPartyId: PartyId,
    purposeId: ErrandId,
    amount: Money,
    paymentMethodId: PaymentMethodId,
  ): PaymentTransaction {
    const id = PaymentTransactionId.create();
    const status = PaymentStatus.PENDING;
    return new PaymentTransaction(
      id,
      clientPartyId,
      purposeId,
      amount,
      status,
      null,
      paymentMethodId,
      null,
      new Date(),
      new Date(),
    );
  }

  markSucceeded(gatewayReference: string, correlationId: string): void {
    if (this._status !== PaymentStatus.PENDING)
      throw new InvariantTransactionError(
        'payment must be pending before you can mark success',
      );

    this._gatewayReference = GatewayReference.create(gatewayReference);
    this._status = PaymentStatus.SUCCEEDED;

    this.addDomainEvent(
      new ChargeSucceededEvent(
        this._method as PaymentMethodId,
        new Date(),
        correlationId,
        {
          purposeId: this.purposeId.toString(),
          currency: this.amount.currency,
          amountMinorUnits: this.amount.amountMinorUnits,
          gatewayReference: this._gatewayReference.value,
          partyId: this.clientPartyId.toString(),
        },
      ),
    );
  }

  markFailed(
    reason: string,
    correlationId: string,
    gatewayReference?: string,
  ): void {
    if (this._status !== PaymentStatus.PENDING)
      throw new InvariantTransactionError(
        'payment must be pending before you can mark failed',
      );

    if (gatewayReference)
      this._gatewayReference = GatewayReference.create(gatewayReference);

    this._status = PaymentStatus.FAILED;

    this.addDomainEvent(
      new ChargeFailedEvent(
        this._method as PaymentMethodId,
        new Date(),
        correlationId,
        {
          purposeId: this.purposeId.toString(),
          partyId: this.clientPartyId.toString(),
          reason,
        },
      ),
    );
  }

  refund(correlationId: string): void {
    if (this._status !== PaymentStatus.SUCCEEDED)
      throw new InvariantTransactionError(
        'payment must be successful before you can refund',
      );

    this._status = PaymentStatus.REFUNDED;

    this.addDomainEvent(
      new ChargeRefundedEvent(
        this._method as PaymentMethodId,
        new Date(),
        correlationId,
        {
          gatewayReference: this._gatewayReference?.value as string,
          amountMinorUnits: this.amount.amountMinorUnits,
        },
      ),
    );
  }
}
