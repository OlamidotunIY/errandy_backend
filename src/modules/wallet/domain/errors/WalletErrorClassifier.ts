import { ErrorClassification, IErrorClassifier } from '@shared';
import {
  DuplicateLedgerEntryError,
  InsufficientActiveBalanceError,
  InsufficientAvailableBalanceError,
  InsufficientPendingBalanceError,
  InvalidLedgerAmountError,
  UnsupportedPendingRefundError,
  WalletNotFoundError,
} from 'src/modules/wallet/domain';

export class WalletErrorClassifier implements IErrorClassifier {
  private static readonly PERMANENT_ERROR_TYPES = [
    WalletNotFoundError,
    InsufficientActiveBalanceError,
    InsufficientPendingBalanceError,
    InsufficientAvailableBalanceError,
    InvalidLedgerAmountError,
    DuplicateLedgerEntryError, // a duplicate means the operation already succeeded once — retrying won't help, and per the idempotency design, this usually means "treat as already done," not "keep trying"
    UnsupportedPendingRefundError,
  ];

  classify(error: unknown): ErrorClassification {
    const isPermanent = WalletErrorClassifier.PERMANENT_ERROR_TYPES.some(
      (ErrorType) => error instanceof ErrorType,
    );
    return isPermanent
      ? ErrorClassification.PERMANENT
      : ErrorClassification.TRANSIENT;
  }
}
