import { DomainError, DomainErrorStatus } from '@src/common';

class UnsupportedPendingRefundError extends DomainError {
  constructor() {
    super('Pending refunds are not supported for this wallet', {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}

export { UnsupportedPendingRefundError };
