import { ErrorClassification } from '..';

export abstract class IErrorClassifier {
  abstract classify(error: Error): ErrorClassification;
}
