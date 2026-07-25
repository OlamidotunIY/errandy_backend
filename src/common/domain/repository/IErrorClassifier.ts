import { ErrorClassification } from '@shared/domain';

export abstract class IErrorClassifier {
  abstract classify(error: Error): ErrorClassification;
}
