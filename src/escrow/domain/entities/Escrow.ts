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
      props.createdAt,
      props.updatedAt,
    );
  }

  hold(completedAt: Date = new Date()): void {
    if (this._status !== EscrowStatus.FUNDED) {
      throw new InvalidStatusTransitionError(this._status, EscrowStatus.HELD);
    }

    const holdUntil = new Date(
      completedAt.getTime() + Escrow.HOLD_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    this._status = EscrowStatus.HELD;
    this._holdUntil = holdUntil;
  }

  fund(): void {
    if (this._status !== EscrowStatus.PENDING) {
      throw new InvalidStatusTransitionError(this._status, EscrowStatus.FUNDED);
    }

    this._status = EscrowStatus.FUNDED;
  }

  beginRelease(): void {
    if (this._status !== EscrowStatus.HELD) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.RELEASING,
      );
    }

    this._status = EscrowStatus.RELEASING;
  }

  beginRefund(reason: RefundReason): void {
    if (this._status !== EscrowStatus.HELD) {
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

  /**
   * Completes refund (REFUNDING → REFUNDED) after funds are returned to client.
   * @param refundedAt Timestamp of successful refund
   * @throws InvalidStatusTransitionError when status is not REFUNDING
   * @emits EscrowRefundedEvent
   */
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

  /**
   * Freezes escrow (HELD → DISPUTED) when a dispute is opened.
   * @throws InvalidStatusTransitionError when status is not HELD
   * @emits EscrowDisputedEvent
   */
  dispute(): void {
    if (this._status !== EscrowStatus.HELD) {
      throw new InvalidStatusTransitionError(
        this._status,
        EscrowStatus.DISPUTED,
      );
    }
    this._status = EscrowStatus.DISPUTED;
    // this.addDomainEvent(new EscrowDisputedEvent(this));
  }

  /**
   * Checks if escrow hold period has expired (current time > holdUntil).
   * Used by scheduled job to auto-release funds to worker after hold period.
   * @returns true if funds can be auto-released to worker
   */
  isHoldExpired(): boolean {
    return (
      this._status === EscrowStatus.HELD &&
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
}
