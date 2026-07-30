import { ApplicationId } from 'src/modules/application/domain';
import { ErrandId } from '@errands';

export interface RejectApplicationPayload {
  id: ApplicationId;
  errandId: ErrandId;
  correlationId?: string;
}
