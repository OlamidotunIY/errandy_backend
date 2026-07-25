import { InvalidApiKeyError, PaystackAuthenticationError } from '../';
import { ErrorClassification, IErrorClassifier } from '@shared';

export class PaymentGatewayErrorClassifier implements IErrorClassifier {
  private static readonly PERMANENT_ERROR_TYPES = [
    InvalidApiKeyError,
    PaystackAuthenticationError,
  ];

  classify(error: unknown): ErrorClassification {
    const isPermanent =
      PaymentGatewayErrorClassifier.PERMANENT_ERROR_TYPES.some(
        (ErrorType) => error instanceof ErrorType,
      );
    return isPermanent
      ? ErrorClassification.PERMANENT
      : ErrorClassification.TRANSIENT;
  }
}
