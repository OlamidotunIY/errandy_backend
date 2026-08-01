import { ErrandId } from '@module/errands';
import { Application } from '../entities';
import { ApplicationId } from '../value-objects';
import { ProviderId } from '@module/providers';

export abstract class IApplicationRepository {
  abstract save(application: Application): Promise<void>;
  abstract findById(id: ApplicationId): Promise<Application | null>;
  abstract findByErrandId(errandId: ErrandId): Promise<Application[]>;
  abstract findByWorkerId(workerId: ProviderId): Promise<Application[]>;
  abstract findPendingByErrandId(errandId: ErrandId): Promise<Application[]>;
  abstract existsByErrandAndWorker(
    errandId: ErrandId,
    workerId: ProviderId,
  ): Promise<boolean>;
}
