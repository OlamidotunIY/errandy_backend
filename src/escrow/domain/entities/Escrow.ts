class Escrow extends AggregateRoot<EscrowId> {
  constructor(
    public readonly id: EscrowId,
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly workerId: string,
    private amountGross: Money,
    private platformFee: Money,
    private amountNetWorker: Money,
    private status: EscrowStatus,
    private holdUntil: Date,
    private releasedAt: Date | null,
    private refundedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(
    errandId: string,
    clientId: string,
    workerId: string,
    amountGross: Money,
    platformFeeRate: number,
    holdUntil?: Date,
  ): Escrow {
    const [platformFee, amountNetWorker] =
      amountGross.splitFee(platformFeeRate);
    const status = EscrowStatus.FUNDED;
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
      holdUntil ?? new Date(),
      releasedAt,
      refundedAt,
      createdAt,
      updatedAt,
    );
  }
}
