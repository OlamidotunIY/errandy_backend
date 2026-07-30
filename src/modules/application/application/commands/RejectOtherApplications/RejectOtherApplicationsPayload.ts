import { ApplicationId } from '@module/application/domain';
import { ErrandId } from '@src/errands';

export interface RejectOtherApplicationsPayload {
  errandId: ErrandId;
  correlationId: string;
  acceptedApplicationId: ApplicationId;
}
