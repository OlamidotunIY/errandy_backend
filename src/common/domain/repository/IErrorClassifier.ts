import { ErrorClassification } from '../value-objects';

export abstract class IErrorClassifier {
  abstract classify(error: Error): ErrorClassification;
}
