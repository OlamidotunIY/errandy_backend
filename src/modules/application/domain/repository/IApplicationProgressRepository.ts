import { AcceptApplicationProgress } from '../entities';
import { ApplicationId } from '@src/modules';

export abstract class IAcceptApplicationProgressRepository {
  abstract save(progress: AcceptApplicationProgress): Promise<void>;
  abstract findByApplicationId(
    applicationId: ApplicationId,
  ): Promise<AcceptApplicationProgress>;
}
