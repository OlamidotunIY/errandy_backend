import { ErrorClassification, IErrorClassifier } from '@shared';
import {
  CurrencyMismatchError,
  EscrowInvariantError,
  InvalidAmountError,
  InvalidFeeRateError,
  InvalidStatusTransitionError,
  NegativeAmountError,
} from '@escrow/domain';

export class EscrowErrorClassifier implements IErrorClassifier {
  private static readonly PERMANENT_ERROR_TYPES = [
    CurrencyMismatchError,
    EscrowInvariantError,
    InvalidAmountError,
    InvalidFeeRateError,
    InvalidStatusTransitionError,
    NegativeAmountError,
  ];
  classify(error: Error): ErrorClassification {
    if (
      EscrowErrorClassifier.PERMANENT_ERROR_TYPES.some(
        (ErrorType) => error instanceof ErrorType,
      )
    ) {
      return ErrorClassification.PERMANENT;
    }
    return ErrorClassification.TRANSIENT;
  }
}
