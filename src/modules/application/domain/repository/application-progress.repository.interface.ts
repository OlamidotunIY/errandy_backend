import { AcceptApplicationProgress } from '../entities';
import { ApplicationId } from '../value-objects';

export abstract class IAcceptApplicationProgressRepository {
  abstract save(progress: AcceptApplicationProgress): Promise<void>;
  abstract findByApplicationId(
    applicationId: ApplicationId,
  ): Promise<AcceptApplicationProgress>;
}
