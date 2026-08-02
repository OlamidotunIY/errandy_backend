import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';
import { Application } from '../entities';
import { ApplicationId } from '../value-objects';

export abstract class IApplicationRepository {
  abstract save(application: Application): Promise<void>;
  abstract findById(id: ApplicationId): Promise<Application | null>;
  abstract findByErrandId(errandId: ErrandId): Promise<Application[]>;
  abstract findByWorkerId(workerId: PartyId): Promise<Application[]>;
  abstract findPendingByErrandId(errandId: ErrandId): Promise<Application[]>;
  abstract existsByErrandAndWorker(
    errandId: ErrandId,
    workerId: PartyId,
  ): Promise<boolean>;
}
