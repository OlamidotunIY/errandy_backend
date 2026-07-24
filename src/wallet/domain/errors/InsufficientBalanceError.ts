import { BucketType } from '@wallet/domain';

class InsufficientBalanceError extends Error {
  constructor(
    bucket: BucketType,
    requiredAmountKobo: number,
    liveBalance: number,
  ) {
    super(
      `Insufficient balance in bucket ${bucket}. Required: ${requiredAmountKobo} kobo, Available: ${liveBalance} kobo.`,
    );
    this.name = 'InsufficientBalanceError';
  }
}

export { InsufficientBalanceError };
