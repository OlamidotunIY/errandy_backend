import { ApplicationId } from '@module/application/domain';
import { ErrandId } from '@module/errands';

export interface RejectApplicationPayload {
  id: ApplicationId;
  errandId: ErrandId;
  correlationId?: string;
}
