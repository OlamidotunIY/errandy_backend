import { AggregateRoot } from '@shared';
import {
  EscrowId,
  EscrowStatus,
  InvalidAmountError,
  InvalidFeeRateError,
  InvalidStatusTransitionError,
  Money,
  RefundReason,
} from '../';

class Escrow extends AggregateRoot<EscrowId> {
  constructor(
    public readonly id: EscrowId,
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly workerId: string,
    private _amountGross: Money,
    private _platformFee: Money,
    private _amountNetWorker: Money,
    private _status: EscrowStatus,
    private _holdUntil: Date | null,
    private _releasedAt: Date | null,
    private _refundedAt: Date | null,
    private _completedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static readonly HOLD_PERIOD_DAYS = 3;

  static create(
    errandId: string,
    clientId: string,
    workerId: string,
    amountGross: Money,
    platformFeeRate: number,
  ): Escrow {
    if (amountGross.amountKobo <= 0) {
      throw new InvalidAmountError('amountGross must be positive');
    }
    if (platformFeeRate < 0 || platformFeeRate > 10000) {
      throw new InvalidFeeRateError(
        'platformFeeRate must be between 0 and 10000 basis points',
      );
    }

    const [platformFee, amountNetWorker] =
      amountGross.splitFee(platformFeeRate);
    const status = EscrowStatus.PENDING;
    const releasedAt = null;
    const refundedAt = null;
    const createdAt = new Date();
    const updatedAt = new Date();

    return new Escrow(
      EscrowId.create(),
      errandId,
      clientId,
      workerId,
      amountGross,
      platformFee,
      amountNetWorker,
      status,
      null,
      releasedAt,
      refundedAt,
      null, // completedAt
      createdAt,
      updatedAt,
    );
  }

  static reconstitute(props: {
    id: EscrowId;
    errandId: string;
    clientId: string;
    workerId: string;
    amountGross: Money;
    platformFee: Money;
    amountNetWorker: Money;
    status: EscrowStatus;
    holdUntil: Date | null;
    releasedAt: Date | null;
    refundedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Escrow {
    return new Escrow(
      props.id,
      props.errandId,
      props.clientId,
      props.workerId,
      props.amountGross,
      props.platformFee,
      props.amountNetWorker,
      props.status,
      props.holdUntil,
      props.releasedAt,
      props.refundedAt,
      props.completedAt,
      props.createdAt,
      props.updatedAt,
    );
  }

  markCompleted(completedAt: Date = new Date()): void {
    if (this._status !== EscrowStatus.FUNDED) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.COMPLETED_PENDING_PAYOUT,
      );
    }

    this._holdUntil = new Date(
      completedAt.getTime() + Escrow.HOLD_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );
    this._completedAt = completedAt;
    this._status = EscrowStatus.COMPLETED_PENDING_PAYOUT;
  }

  fund(): void {
    if (this._status !== EscrowStatus.PENDING) {
      throw new InvalidStatusTransitionError(this._status, EscrowStatus.FUNDED);
    }

    this._status = EscrowStatus.FUNDED;
  }

  beginRelease(): void {
    if (this._status !== EscrowStatus.COMPLETED_PENDING_PAYOUT) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.RELEASING,
      );
    }

    this._status = EscrowStatus.RELEASING;
  }

  beginRefund(reason: RefundReason): void {
    if (this._status !== EscrowStatus.COMPLETED_PENDING_PAYOUT) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.REFUNDING,
      );
    }
    this._status = EscrowStatus.REFUNDING;
    // this.addDomainEvent(new EscrowRefundingEvent(this, reason));
  }

  completeRelease(releasedAt: Date): void {
    if (this._status !== EscrowStatus.RELEASING) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.RELEASED,
      );
    }
    this._status = EscrowStatus.RELEASED;
    this._releasedAt = releasedAt;
    // this.addDomainEvent(new EscrowReleasedEvent());
  }

  completeRefund(refundedAt: Date): void {
    if (this._status !== EscrowStatus.REFUNDING) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.REFUNDED,
      );
    }
    this._status = EscrowStatus.REFUNDED;
    this._refundedAt = refundedAt;
    // this.addDomainEvent(new EscrowRefundedEvent(this));
  }

  dispute(): void {
    if (this._status !== EscrowStatus.COMPLETED_PENDING_PAYOUT) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.DISPUTED,
      );
    }
    this._status = EscrowStatus.DISPUTED;
    // this.addDomainEvent(new EscrowDisputedEvent(this));
  }

  isHoldExpired(): boolean {
    return (
      this._status === EscrowStatus.COMPLETED_PENDING_PAYOUT &&
      this._holdUntil !== null &&
      new Date() > this._holdUntil
    );
  }

  // Getters
  get amountGross(): Money {
    return this._amountGross;
  }
  get platformFee(): Money {
    return this._platformFee;
  }
  get amountNetWorker(): Money {
    return this._amountNetWorker;
  }
  get status(): EscrowStatus {
    return this._status;
  }
  get holdUntil(): Date | null {
    return this._holdUntil;
  }
  get releasedAt(): Date | null {
    return this._releasedAt;
  }
  get refundedAt(): Date | null {
    return this._refundedAt;
  }
  get completedAt(): Date | null {
    return this._completedAt;
  }
}

export { Escrow };
