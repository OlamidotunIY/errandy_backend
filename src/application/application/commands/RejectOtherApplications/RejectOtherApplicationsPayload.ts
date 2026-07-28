import { ErrandId } from '@errands';
import { ApplicationId } from '@application/domain';

export interface RejectOtherApplicationsPayload {
  errandId: ErrandId;
  correlationId: string;
  acceptedApplicationId: ApplicationId;
}
