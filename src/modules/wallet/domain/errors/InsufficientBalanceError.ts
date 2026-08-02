import { DomainError, DomainErrorStatus } from '@src/common';
import { BucketType } from 'src/modules/wallet/domain';

class InsufficientBalanceError extends DomainError {
  constructor(
    bucket: BucketType,
    requiredAmountMinorUnits: number,
    liveBalance: number,
  ) {
    super(
      `Insufficient balance in bucket ${bucket}. Required: ${requiredAmountMinorUnits} minor units, Available: ${liveBalance} minor units.`,
      { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY },
    );
  }
}

export { InsufficientBalanceError };
