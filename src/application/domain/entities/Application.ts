import { AggregateRoot } from '@shared';
import { ApplicationId, ApplicationStatus } from '../value-objects';
import { ErrandId } from '@errands';
import { ProviderId } from '@provider';

export class Application extends AggregateRoot<ApplicationId> {
  constructor(
    id: ApplicationId,
    errandId: ErrandId,
    workerId: ProviderId,
    status: ApplicationStatus,
    proposal: string,
    proposedAmountKobo: number,
    currency: string,
    acceptedAt: Date | null,
    rejectedAt: Date | null,
    cancelledAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id);
  }
}
