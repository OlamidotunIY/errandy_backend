import { ErrandId } from '@errands';
import { ApplicationId } from 'src/modules/application/domain';

export interface RejectOtherApplicationsPayload {
  errandId: ErrandId;
  correlationId: string;
  acceptedApplicationId: ApplicationId;
}
