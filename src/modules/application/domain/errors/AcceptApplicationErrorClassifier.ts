import { ErrorClassification, IErrorClassifier } from '@src/common';
import {
  ApplicationInvariantError,
  ApplicationNotFoundError,
  DuplicateApplicationError,
} from '@src/modules';

export class AcceptApplicationErrorClassifier implements IErrorClassifier {
  private static readonly PERMANENT_ERROR_TYPES = [
    ApplicationInvariantError,
    ApplicationNotFoundError,
    DuplicateApplicationError,
  ];

  classify(error: Error): ErrorClassification {
    if (
      AcceptApplicationErrorClassifier.PERMANENT_ERROR_TYPES.some(
        (ErrorType) => error instanceof ErrorType,
      )
    ) {
      return ErrorClassification.PERMANENT;
    }
    return ErrorClassification.TRANSIENT;
  }
}
